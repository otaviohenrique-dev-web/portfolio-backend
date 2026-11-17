// index.js
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app = express();
app.use(express.json());
const allowedOrigins = (process.env.CORS_ORIGINS || 'https://portifoliootaviodevweb.vercel.app,http://localhost:3000').split(',');
app.use(cors({ origin: allowedOrigins }));

// 1. Conexão com MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Conectado"))
    .catch(err => console.log(err));

// 2. Configuração Cloudinary (Imagens)
cloudinary.config({
    cloud_name: process.env.CLOUD_NAME,
    api_key: process.env.CLOUD_KEY,
    api_secret: process.env.CLOUD_SECRET
});

const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: { folder: 'portfolio_projects' },
});
const upload = multer({ storage: storage });

// 3. Modelo do Banco de Dados
const ProjectSchema = new mongoose.Schema({
    title: String,
    description: String,
    technologies: [String],
    repoUrl: String,
    demoUrl: String,
    images: [{ original: String, thumbnail: String }] // Formato da galeria
});
const Project = mongoose.model('Project', ProjectSchema);

// Autenticação simples para rotas de escrita (defina ADMIN_TOKEN no Render).
// Sem ADMIN_TOKEN configurado, toda escrita é recusada (falha fechada).
const crypto = require('crypto');
function requireAdmin(req, res, next) {
    const expected = process.env.ADMIN_TOKEN;
    const received = req.get('x-admin-token') || '';
    if (!expected) return res.status(503).json({ error: 'ADMIN_TOKEN não configurado no servidor' });
    const a = Buffer.from(received);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        return res.status(401).json({ error: 'Não autorizado' });
    }
    next();
}

// --- ROTAS ---

// GET: Pegar todos os projetos
app.get('/projects', async (req, res) => {
    const projects = await Project.find();
    res.json(projects);
});

// POST: Criar projeto (Com upload de até 5 imagens)
app.post('/projects', requireAdmin, upload.array('images', 5), async (req, res) => {
    try {
        const { title, description, repoUrl, demoUrl, technologies } = req.body;
        
        // Converte as imagens para o formato que o React Gallery aceita
        const imageList = req.files.map(file => ({
            original: file.path,
            thumbnail: file.path
        }));

        const newProject = new Project({
            title,
            description,
            repoUrl,
            demoUrl,
            technologies: technologies.split(','), // Recebe string separada por virgula
            images: imageList
        });

        await newProject.save();
        res.json(newProject);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao salvar projeto' });
    }
});

// DELETE: Apagar projeto
app.delete('/projects/:id', requireAdmin, async (req, res) => {
    await Project.findByIdAndDelete(req.params.id);
    res.json({ message: "Deletado com sucesso" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));