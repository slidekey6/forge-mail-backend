const fetch = require('node-fetch');
require('dotenv').config();

async function test() {
  const emailId = "6792269b-ff97-46c4-9725-d4e05afb67e6";
  try {
    const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`
      }
    });
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch(e) {
    console.error(e);
  }
}
test();
