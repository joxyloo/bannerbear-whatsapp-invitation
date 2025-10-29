require('dotenv').config();
const fs = require('fs');
const csv = require('csv-parser');
const { Bannerbear } = require('bannerbear');

// Function to read guests from a CSV file
function readGuestsFromCSV(filePath) {
  return new Promise((resolve, reject) => {
    const guests = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        if (row.name && row.phone) { // Expected CSV columns: name, phone
          guests.push({
            name: row.name.trim(),
            phone: row.phone.trim(),
          });
        }
      })
      .on('end', () => {
        console.log(`Loaded ${guests.length} guests from CSV`);
        resolve(guests);
      })
      .on('error', (err) => {
        reject(err);
      });
  });
}

async function createInviteImage(guestName) {
  const bb = new Bannerbear(process.env.BANNERBEAR_API_KEY);
  const image = await bb.create_image(
    process.env.BANNERBEAR_TEMPLATE_ID,
    {
      modifications: [
        {
          name: 'recipient_name',
          text: guestName,
        },
      ],
    },
    true
  );

  console.log(`Image created for ${guestName}:`, image.image_url);
  return image.image_url;
}

async function sendTemplateWithImageURL(imageUrl, guestName, guestPhone) {
  const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
  const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const url = `https://graph.facebook.com/v20.0/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: 'whatsapp',
    to: guestPhone,
    type: 'template',
    template: {
      name: 'wedding_invitation',
      language: { code: 'en' },
      components: [
        {
          type: 'header',
          parameters: [
            {
              type: 'image',
              image: { link: imageUrl },
            },
          ],
        },
        {
          type: 'body',
          parameters: [
            { type: 'text', text: guestName },
            { type: 'text', text: '1 Apr 26' },
            { type: 'text', text: '7:00pm' },
            { type: 'text', text: 'Hard Rock Hotel, Pattaya' },
            { type: 'text', text: '1 Nov 25' },
            { type: 'text', text: 'Abbey' },
            { type: 'text', text: 'John' },
          ],
        },
      ],
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error('❌ Send error:', data);
    throw new Error(`WhatsApp API error: ${res.status}`);
  }
  console.log(`Message sent to ${guestName}:`, data);
}

async function main() {
  try {
    const guests = await readGuestsFromCSV('Abbey-John Wedding Guest List.csv');

    for (const g of guests) {
      const imageUrl = await createInviteImage(g.name);
      await sendTemplateWithImageURL(imageUrl, g.name, g.phone);
      console.log(`Invitation sent to ${g.name}`);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
