// Impor library yang diperlukan
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const net = require('net');
require('dotenv').config(); // Untuk mengelola variabel environment

// Konfigurasi
const SERVER_IP = "15.235.166.218";
const HTTPS_PORT = 443;  // HTTPS umumnya menggunakan port 443
const CHECK_INTERVAL = 10;  // Interval pengecekan (dalam detik)
const DISCORD_TOKEN = process.env.DISCORD_TOKEN; // Token dari variabel environment
const CHANNEL_ID = process.env.CHANNEL_ID || "1372394383084753000";

// Setup bot Discord
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

// Variabel status
let previousHttpsStatus = null;
let httpsStatusChangeTime = null;
let statusMessage = null;

// Fungsi untuk memformat durasi
function formatDuration(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = Math.floor(seconds % 60);

    const parts = [];
    if (days > 0) parts.push(`${days} hari`);
    if (hours > 0) parts.push(`${hours} jam`);
    if (minutes > 0) parts.push(`${minutes} menit`);
    if (remainingSeconds > 0) parts.push(`${remainingSeconds} detik`);

    return parts.length > 0 ? parts.join(", ") : "baru saja";
}

// Fungsi untuk memeriksa port
function checkPort(ip, port, timeout = 5000) {
    return new Promise((resolve) => {
        const socket = new net.Socket();
        
        // Atur timeout socket
        socket.setTimeout(timeout);
        
        // Mencoba terhubung
        const connection = socket.connect(port, ip, () => {
            socket.end();
            resolve(true); // Port terbuka
        });
        
        // Handler untuk kesalahan
        socket.on('error', () => {
            resolve(false); // Port tertutup atau error
        });
        
        // Handler untuk timeout
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false); // Timeout
        });
    });
}

// Saat bot siap
client.once('ready', () => {
    console.log(`Bot login sebagai ${client.user.tag}`);
    serverStatusCheck();
    setInterval(serverStatusCheck, CHECK_INTERVAL * 1000);
    setInterval(countdownLoop, 1000);
});

// Fungsi pengecekan status server
async function serverStatusCheck() {
    // Periksa status HTTPS (port 443)
    const httpsIsUp = await checkPort(SERVER_IP, HTTPS_PORT);
    
    const now = Date.now() / 1000; // Waktu saat ini dalam detik

    // Perbarui waktu perubahan status jika status berubah
    if (previousHttpsStatus !== httpsIsUp) {
        httpsStatusChangeTime = now;
        previousHttpsStatus = httpsIsUp;
    }
    
    // Jika waktu perubahan belum diinisialisasi, inisialisasi sekarang
    if (httpsStatusChangeTime === null) {
        httpsStatusChangeTime = now;
    }

    const httpsDuration = formatDuration(now - httpsStatusChangeTime);

    // Buat embed dengan informasi status
    const embed = new EmbedBuilder()
        .setTitle("Status Monitoring Server")
        .setColor(0x0099FF)
        .setTimestamp();
    
    // Status HTTPS
    const httpsStatusText = httpsIsUp ? "🟢 **UP**" : "🔴 **DOWN**";
    embed.addFields({
        name: "HTTPS (Port 443)",
        value: `Status: ${httpsStatusText}\n${httpsIsUp ? 'Aktif selama' : 'Tidak aktif sejak'}: ${httpsDuration}`,
        inline: false
    });
    
    // Tambahkan informasi pengecekan berikutnya
    embed.setFooter({ text: `Pengecekan selanjutnya dalam ${CHECK_INTERVAL} detik...` });

    // Kirim atau perbarui pesan
    try {
        const channel = client.channels.cache.get(CHANNEL_ID);
        if (channel) {
            if (statusMessage) {
                await statusMessage.edit({ embeds: [embed] });
            } else {
                statusMessage = await channel.send({ embeds: [embed] });
            }
        }
    } catch (error) {
        console.error("Error saat mengirim update status:", error);
    }
}

// Fungsi countdown
async function countdownLoop() {
    if (statusMessage && statusMessage.embeds && statusMessage.embeds.length > 0) {
        try {
            const embed = EmbedBuilder.from(statusMessage.embeds[0]);
            const footerText = embed.data.footer.text;
            
            if (footerText.includes("Pengecekan selanjutnya dalam")) {
                const secondsLeft = parseInt(footerText.split("dalam")[1].split(" ")[1]);
                if (secondsLeft > 1) {
                    embed.setFooter({ text: `Pengecekan selanjutnya dalam ${secondsLeft - 1} detik...` });
                } else {
                    embed.setFooter({ text: "Pengecekan berikutnya..." });
                }
                
                await statusMessage.edit({ embeds: [embed] });
            }
        } catch (error) {
            console.error("Error saat memperbarui countdown:", error);
        }
    }
}

// Login ke Discord
client.login(DISCORD_TOKEN);
