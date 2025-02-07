const express = require("express");
const cors = require("cors");
const bodyparser = require("body-parser");
const bot = require("./bot");

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyparser.json());

app.get("/", (req, res) => {
    res.send("Api funcionando");  
});

app.listen(port, () => {
    console.log(`Server rodando na porta ${port}`);
});

const botInstance = new bot.Bot();

app.get("/initialize", async (req, res) => {
    console.log("Inicializando o bot");
    await botInstance.initialize();
    res.json({ sucess: true, message: "Bot inicializado" });
});

app.get("/qrcode", (req, res) => {
    console.log("Retornando QR Code");
    res.json({ qrcode: botInstance.getQRCode() });
});

app.post("/send", (req, res) => {
    const { phone, message } = req.body;

    if (!phone || !message) {
        return res.status(400).json({ success: false, message: "Número e mensagem são obrigatórios!" });
    }

    botInstance.client.sendMessage(phone, message)
        .then((response) => {
            console.log("Mensagem enviada:", response);
            res.status(200).json({ success: true, message: "Mensagem enviada com sucesso!" });
        })
        .catch((error) => {
            console.error("Erro ao enviar mensagem:", error);
            res.status(500).json({ success: false, message: "Erro ao enviar mensagem!" });
        });
});
