async function test() {
  try {
    const res = await fetch('http://localhost:3000/api/health');
    console.log('Health check:', res.status, await res.json());
    
    const entriesRes = await fetch('http://localhost:3000/api/entries');
    console.log('Entries check:', entriesRes.status);
    
    const postRes = await fetch('http://localhost:3000/api/entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes: 'Teste', nf_numero: '123' })
    });
    console.log('POST check:', postRes.status, await postRes.json());
  } catch (e) {
    console.error('Test failed:', e);
  }
}
test();
