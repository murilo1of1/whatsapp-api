
const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.json({ limit: '50mb' }));


const sessionsDir = path.join(__dirname, 'sessions'); // Diretório onde as sessões estão armazenadas
let sessions = {}; // Armazena as sessões ativas e os QR Codes

// Função para criar um cliente para um número de telefone específico
function createClient(sessionId) {
    const client = new Client({
        authStrategy: new LocalAuth({ clientId: sessionId, dataPath: sessionsDir }), // Usa ID único para a sessão
        puppeteer: {headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-extensions']}
    });

    client.on('qr', (qr) => {
        sessions[sessionId].qrCode = qr;
    });

    client.on('ready', () => {
        console.log(`${sessionId} está pronto!`);
    });

    client.on('authenticated', () => {
        console.log(`Sessão de ${sessionId} autenticada.`);
    });

    client.initialize();
    return client;
}

// Carrega sessões existentes ao iniciar o servidor
function loadExistingSessions() {
    if (fs.existsSync(sessionsDir)) {
        const sessionFiles = fs.readdirSync(sessionsDir);
        sessionFiles.forEach((file) => {
            const sessionId = path.parse(file).name.split('-')[1];
            const client = createClient(sessionId);
            sessions[sessionId] = client;
        });
    }
}

loadExistingSessions();

// Endpoint para iniciar uma sessão
app.get('/start-session/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    if (sessions[sessionId]) {
        return res.status(400).json({ message: 'Sessão já está ativa.' });
    }

    const client = createClient(sessionId);
    sessions[sessionId] = client;

    res.status(200).json({ message: `Sessão para o número ${sessionId} iniciada.` });
});

// Endpoint para enviar mensagens e arquivos
app.post('/send-message/:sessionId', async (req, res) => {
    console.log('passo1');
    const { sessionId } = req.params;
    const { para, nomeArquivo, arquivoBase64, mensagem } = req.body;

    console.log('passo2');

    if (!sessions[sessionId]) {
        return res.status(400).json({ message: 'Sessão não encontrada.' });
    }

    const client = sessions[sessionId];

    // Busca o nome correto da pasta da sessão
    const sessionFiles = fs.readdirSync(sessionsDir);
    const sessionFolder = sessionFiles.find(folder => folder.includes(sessionId));

    if (!sessionFolder) {
        console.error(`A sessão ${sessionId} não foi encontrada no servidor.`);
        return res.status(400).json({ message: `Sessão ${sessionId} não encontrada no servidor.` });
    }

    const sessionPath = path.join(sessionsDir, sessionFolder);
    console.log(`Sessão localizada: ${sessionPath}`);

    // Verifica se há arquivos de autenticação na pasta
    const sessionFilesInFolder = fs.readdirSync(sessionPath);
    if (sessionFilesInFolder.length === 0) {
        console.error(`A pasta da sessão ${sessionId} está vazia.`);
        return res.status(400).json({ message: `Sessão ${sessionId} não possui arquivos de autenticação.` });
    }


    // Se o cliente não existir, tenta recriá-lo
    if (!client) {
        console.error(`Cliente da sessão ${sessionId} não foi encontrado. Criando novo cliente...`);
        sessions[sessionId] = createClient(sessionId);
        return res.status(202).json({ message: 'Sessão não encontrada. Criando uma nova, tente novamente em alguns segundos.', status: 'restarting' });
    }


    // Verifica se o cliente está autenticado corretamente
    if (!client.info || !client.info.wid) {
        console.error(`Sessão ${sessionId} não está autenticada. Tentando reiniciar...`);
        
        // Reinicia a sessão
        client.initialize();
    
        return res.status(202).json({ message: 'Sessão não estava autenticada. Tentamos reiniciar, tente novamente em alguns segundos.', status: 'restarting' });
    }
    
    // Se passou por todas as verificações, significa que a sessão está OK
    try {
        if (arquivoBase64 && nomeArquivo) {
	    console.log('passo3.1');
            // Criar a mídia com o nome do arquivo
            const media = new MessageMedia('application/pdf', arquivoBase64, nomeArquivo);

            // Enviar o arquivo sem legenda
            await client.sendMessage(`${para}@c.us`, media);
        } else if (mensagem) {
            console.log('passo3.2');
            // Enviar apenas a mensagem de texto
            await client.sendMessage(`${para}@c.us`, mensagem);
        } else {
            console.log('passo3.3');
            return res.status(400).json({ message: "Nenhuma mensagem ou arquivo enviado." });
        }

        res.status(200).json({ message: 'Mensagem enviada com sucesso!' });
    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        res.status(500).json({ message: 'Erro ao enviar mensagem.', error: error.message });
    }
});


// Endpoint para obter o QR Code de uma sessão
app.get('/get-qrcode/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    if (!sessions[sessionId] || !sessions[sessionId].qrCode) {
        return res.status(404).json({ message: 'QR Code não disponível ou sessão não encontrada.' });
    }

    const qrCode = sessions[sessionId].qrCode;
    res.status(200).json({ qrCode });
});

app.listen(port, () => {
    console.log(`API rodando na porta ${port}`);
});
