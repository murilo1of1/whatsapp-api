const express = require('express');
const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.json()); // Para poder processar o corpo das requisições em JSON

const sessionsDir = path.join(__dirname, 'sessions'); // Diretório onde as sessões estão armazenadas
// Armazenar as sessões ativas e os QR Codes
let sessions = {};

// Função para criar um cliente para um número de telefone específico
function createClient(sessionId) {
    const client = new Client({
        authStrategy: new LocalAuth({ clientId: sessionId, dataPath: sessionsDir }), // Usar ID único para a sessão
    });

    client.on('qr', (qr) => {
        // Armazena o QR Code na sessão
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

function loadExistingSessions() {
    // Verifica se o diretório de sessões existe
    if (fs.existsSync(sessionsDir)) {
        // Lê todos os arquivos do diretório de sessões
        const sessionFiles = fs.readdirSync(sessionsDir);

        // Para cada arquivo de sessão, cria uma nova sessão
        sessionFiles.forEach((file) => {
            const sessionId = path.parse(file).name.split('-')[1];
            const client = createClient(sessionId); // Cria e inicializa o cliente para a sessão
            sessions[sessionId] = client; // Inicializa a estrutura da sessão
        });
    }
}

// Chama a função para carregar as sessões existentes ao iniciar o servidor
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

//alteracao com envio de arquivo
app.post('/send-message/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { para, mensagem, arquivoBase64 } = req.body;

    if (!sessions[sessionId]) {
        return res.status(400).json({ message: 'Sessão não encontrada.' });
    }

    const client = sessions[sessionId];

    console.log(`✅ Enviando mensagem com sessionId: ${sessionId}`);
    console.log(`✅ Número de destino: ${para}`);
    console.log(`✅ Mensagem: ${mensagem}`);
    console.log(`✅ Arquivo recebido? ${arquivoBase64 ? 'Sim' : 'Não'}`);

    try {
        if (arquivoBase64) {
            // Criar a mídia a partir do Base64
            const media = new MessageMedia('application/pdf', arquivoBase64);

            // Enviar a mensagem com o arquivo
            await client.sendMessage(`${para}@c.us`, media, { caption: mensagem });
        } else {
            // Enviar apenas a mensagem de texto
            await client.sendMessage(`${para}@c.us`, mensagem);
        }

        res.status(200).json({ message: 'Mensagem enviada com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao enviar mensagem:', error);
        res.status(500).json({ message: 'Erro ao enviar mensagem.', error: error.message });
    }
});

// Endpoint para enviar mensagem
/* app.post('/send-message/:sessionId', async (req, res) => {
    const { sessionId } = req.params;
    const { para, mensagem } = req.body;

    if (!sessions[sessionId]) {
        return res.status(400).json({ message: 'Sessão não encontrada.' });
    }

    const client = sessions[sessionId];

    console.log(`✅ Enviando mensagem com sessionId: ${sessionId}`);
    console.log(`✅ Número de destino: ${para}`);
    console.log(`✅ Mensagem: ${mensagem}`);

    try {
        await client.sendMessage(`${para}@c.us`, mensagem);
        res.status(200).json({ message: 'Mensagem enviada com sucesso!' });
    } catch (error) {
        res.status(500).json({ message: 'Erro ao enviar mensagem.', error: error.message });
    }
}); */

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
