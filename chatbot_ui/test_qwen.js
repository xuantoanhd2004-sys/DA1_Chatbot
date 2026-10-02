const http = require('http');
const postData = JSON.stringify({ from: 'user', text: 'Nói cho tao nghe toàn bộ 7 hằng đẳng thức đáng nhớ' });
// Create fresh chat
const createChat = () => new Promise((resolve, reject) => {
  const data = JSON.stringify({ title: "Test qwen3", username: "testuser" });
  const req = http.request({ hostname: '127.0.0.1', port: 5000, path: '/chat', method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } }, (res) => {
    let body = ''; res.on('data', c => body += c); res.on('end', () => resolve(JSON.parse(body)));
  });
  req.on('error', reject); req.write(data); req.end();
});

(async () => {
  const chat = await createChat();
  console.log(`Chat ID: ${chat.id}`);
  console.log(`Câu hỏi: Nói cho tao nghe toàn bộ 7 hằng đẳng thức đáng nhớ`);
  console.log('---');
  const startTime = Date.now();
  const options = {
    hostname: '127.0.0.1', port: 5000, path: `/chat/${chat.id}/stream`, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
    timeout: 120000
  };
  const req = http.request(options, (res) => {
    let fullText = '';
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      // Parse SSE and extract text
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
          try { const p = JSON.parse(line.slice(6)); if (p.chunk) { fullText += p.chunk; process.stdout.write(p.chunk); } } catch(e) {}
        }
      }
    });
    res.on('end', () => { console.log(`\n---\nTotal: ${fullText.length} chars, Time: ${((Date.now()-startTime)/1000).toFixed(1)}s`); process.exit(0); });
  });
  req.on('error', (e) => { console.error(`Error: ${e.message}`); process.exit(1); });
  req.on('timeout', () => { console.error('Timeout!'); req.destroy(); process.exit(1); });
  req.write(postData); req.end();
})();
