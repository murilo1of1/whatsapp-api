const { Client, LocalAuth } = require("whatsapp-web.js");

class Bot {
    constructor() {
        this.client = new Client({
            authStrategy: new LocalAuth()
        });

        this.qrCode = null;

        this.client.on("qr", (qr) => {
            console.log("Novo QR Code gerado.");
            this.qrCode = qr;
        });

        this.client.on("ready", () => {
            console.log("Bot conectado com sucesso!");
            this.qrCode = null;
        });

        this.client.on("disconnected", () => {
            console.log("Bot foi desconectado!");
            this.qrCode = null;
        });
    }

    async initialize() {
        console.log("Inicializando o bot...")
        await this.client.initialize();
    }

    getQRCode() {
        return this.qrCode ? this.qrCode : "QR Code ainda não gerado.";
    }
}

module.exports = { Bot };

