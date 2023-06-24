const dgram = require('dgram');
const fs = require('fs');

const server = dgram.createSocket('udp4');
const clientAddress = '127.0.0.1'; // Endereço do cliente
const clientPort = 3000; // Porta do cliente
const packetSize = 1024; // Tamanho máximo de cada pacote
const windowSize = 10; // Tamanho da janela deslizante
const outputDir = './arquivos_recebidos'; // Diretório de saída para salvar os pacotes recebidos
const outputFile = `${outputDir}/recebidos.txt`; // Nome do arquivo de saída

const receivedData = new Map(); // Mapa para armazenar os pacotes recebidos
let expectedSequenceNumber = 0; // Número de sequência esperado
let lastAckSent = -1; // Último ACK enviado
let congestionWindow = 1; // Tamanho inicial da janela de congestionamento
let slowStartThreshold = windowSize * packetSize; // Limite para o início da fase de congestion avoidance

// Cria o diretório de saída, se não existir
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
  console.log(`Diretório ${outputDir} criado.`);
} else {
  console.log(`Diretório ${outputDir} já existe.`);
}

server.on('message', (message, rinfo) => {
  const packet = JSON.parse(message.toString());

  if (packet.packetNumber === expectedSequenceNumber) {
    receivedData.set(packet.packetNumber, packet.data);

    while (receivedData.has(expectedSequenceNumber)) {
      const packetData = receivedData.get(expectedSequenceNumber);
      receivedData.delete(expectedSequenceNumber);

      console.log(`Pacote ${expectedSequenceNumber} recebido.`);

      if (expectedSequenceNumber === 0) {
        // Primeiro pacote contém o nome do arquivo
        fs.writeFileSync(outputFile, packetData);
      } else {
        // Demais pacotes contêm dados do arquivo
        fs.appendFileSync(outputFile, packetData);
      }

      expectedSequenceNumber++;
    }

    if (expectedSequenceNumber - 1 > lastAckSent) {
      sendACK(expectedSequenceNumber - 1);
    }
  } else if (packet.packetNumber > expectedSequenceNumber) {
    receivedData.set(packet.packetNumber, packet.data);
  }

  if (packet.packetNumber >= lastAckSent + windowSize) {
    sendACK(lastAckSent + windowSize);
  }
});

function sendACK(ackNumber) {
  const ackPacket = {
    ackNumber: ackNumber.toString(),
    windowSize: windowSize.toString(),
    congestionWindow: congestionWindow.toString(),
    slowStartThreshold: slowStartThreshold.toString(),
  };

  const ackBuffer = Buffer.from(JSON.stringify(ackPacket));
  server.send(ackBuffer, 0, ackBuffer.length, clientPort, clientAddress, (err) => {
    if (err) {
      console.error(`Erro ao enviar ACK para pacote ${ackNumber}: ${err}`);
    } else {
      console.log(`ACK ${ackNumber} enviado.`);
    }
  });

  lastAckSent = ackNumber;
}

server.on('listening', () => {
  const address = server.address();
  console.log(`Servidor iniciado. Aguardando dados do cliente em ${address.address}:${address.port}`);
});

server.bind(clientPort, clientAddress);
