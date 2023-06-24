const dgram = require('dgram');
const fs = require('fs');

const client = dgram.createSocket('udp4');
const serverAddress = '127.0.0.1'; // Endereço do servidor
const serverPort = 3000; // Porta do servidor
const packetSize = 1024; // Tamanho máximo de cada pacote

const filePath = './arquivo/enviar.txt'; // Caminho do arquivo a ser enviado

// Lê o arquivo de entrada
fs.readFile(filePath, (err, data) => {
  if (err) {
    console.error(`Erro ao ler o arquivo ${filePath}: ${err}`);
    return;
  }

  const totalPackets = Math.ceil(data.length / packetSize);
  console.log(`Enviando arquivo ${filePath} em ${totalPackets} pacotes.`);

  let sentPackets = 0; // Número de pacotes enviados
  let lastAckReceived = -1; // Último ACK recebido
  let cwnd = 1; // Tamanho da janela de congestionamento

  function sendNextPacket() {
    const start = sentPackets * packetSize;
    const end = start + packetSize;
    const packetData = data.slice(start, end);

    const packet = {
      packetNumber: sentPackets,
      data: packetData.toString(),
    };

    const packetBuffer = Buffer.from(JSON.stringify(packet));
    client.send(packetBuffer, 0, packetBuffer.length, serverPort, serverAddress, (err) => {
      if (err) {
        console.error(`Erro ao enviar pacote ${sentPackets}: ${err}`);
      } else {
        console.log(`Pacote ${sentPackets} enviado.`);
      }
    });

    sentPackets++;

    if (sentPackets - 1 <= lastAckReceived + cwnd) {
      setTimeout(sendNextPacket, 0);
    }
  }

  client.on('message', (message) => {
    const ack = JSON.parse(message.toString());
    const receivedAck = parseInt(ack.ackNumber);

    console.log(`ACK ${receivedAck} recebido.`);

    if (receivedAck > lastAckReceived) {
      lastAckReceived = receivedAck;

      if (cwnd < ack.windowSize) {
        cwnd = ack.windowSize;
      } else {
        cwnd += 1;
      }

      if (lastAckReceived < totalPackets - 1) {
        setTimeout(sendNextPacket, 0);
      } else {
        console.log('Arquivo enviado com sucesso.');
        client.close();
      }
    }
  });

  sendNextPacket();
});
