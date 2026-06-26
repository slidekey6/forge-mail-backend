const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

async function test() {
  const emailId = "6792269b-ff97-46c4-9725-d4e05afb67e6";
  try {
    const fullEmail = await resend.emails.get(emailId);
    console.log(JSON.stringify(fullEmail, null, 2));
  } catch(e) {
    console.error(e);
  }
}
test();
