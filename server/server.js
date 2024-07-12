const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const PDFDocument = require('pdfkit');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB connection
mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

const CertificateSchema = new mongoose.Schema({
    name: String,
    course: String,
    date: String,
    email: String,
    link: String
});

const Certificate = mongoose.model('Certificate', CertificateSchema);

// Google Drive setup with direct credentials
// const client_email = "certificate-generation@learned-skill-429117-r0.iam.gserviceaccount.com";

const auth = new google.auth.GoogleAuth({
    credentials: {
        private_key: process.env.private_key,
        client_email: process.env.client_email
    },
    scopes: ['https://www.googleapis.com/auth/drive.file']
});
const drive = google.drive({ version: 'v3', auth });

// Multer setup for file uploads
const upload = multer({ dest: 'uploads/' });

app.post('/api/generate-certificate', async (req, res) => {
    const { name, course, date, email } = req.body;

    // Generate PDF logic (simple text for now)
    const pdfPath = path.join(__dirname, 'certificate.pdf');
    const doc = new PDFDocument({
        size: [597.6, 842.4],
        margins: { top: 90, bottom: 50, left: 50, right: 50 }
    });

    // Add a background color
    doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f3f3f3');

    // Add certificate title
    doc.fillColor('#333333')
        .fontSize(30)
        .font('Times-Bold')
        .text('CERTIFICATE OF COMPLETION', {
            align: 'center'
            // y: t
        });

    doc.moveDown(2);

    // Add recipient name placeholder
    doc.fontSize(20)
        .font('Times-Roman')
        .text('This certificate is proudly presented to', {
            align: 'center'
        });

    doc.moveDown(1);

    // Add recipient name
    doc.fontSize(30)
        .font('Times-Bold')
        .fillColor('#1e90ff')
        .text(`${name}`, {
            align: 'center',
            underline: true
        });

    doc.moveDown(1);

    // Add course completion text
    doc.fontSize(20)
        .font('Times-Roman')
        .fillColor('#333333')
        .text('has successfully completed the course', {
            align: 'center'
        });

    doc.moveDown(1);

    // Add course name
    doc.fontSize(25)
        .font('Times-Bold')
        .fillColor('#1e90ff')
        .text(`${course}`, {
            align: 'center'
        });

    doc.moveDown(1);

    // Add issue date
    doc.fontSize(20)
        .font('Times-Roman')
        .fillColor('#333333')
        .text(`Issue Date: ${date}`, {
            align: 'center'
        });

    doc.moveDown(2);

    // Add best wishes text
    doc.fontSize(20)
        .font('Times-Roman')
        .fillColor('#333333')
        .text('Tutedude wishes you the best for your future endeavours.', {
            align: 'center'
        });

    doc.moveDown(2);

    // Add signatures
    doc.fontSize(20)
        .font('Times-Bold')
        .text('SHIVAM GOYA', {
            align: 'left',
            continued: true
        })
        .text('ABHISHEK GANGWAR', {
            align: 'right'
        });

    doc.moveDown(1);

    doc.fontSize(16)
        .font('Times-Roman')
        .text('Co-Founder', {
            align: 'left',
            continued: true
        })
        .text('Co-Founder', {
            align: 'right'
        });

    doc.moveDown(2);

    // Add certificate ID placeholder
    doc.fontSize(16)
        .font('Times-Roman')
        .text('Certificate ID: ___________', {
            align: 'center'
        });

    // Add a border
    doc.lineWidth(2)
        .strokeColor('#1e90ff')
        .rect(50, 50, doc.page.width - 100, doc.page.height - 100)
        .stroke();

    // Finalize the PDF and write to file
    doc.pipe(fs.createWriteStream(pdfPath));
    doc.end();
    
    try {
        // Upload to Google Drive
        const fileMetadata = { name: 'certificate.pdf' };
        const media = {
            mimeType: 'application/pdf',
            body: fs.createReadStream(pdfPath)
        };
        const response = await drive.files.create({
            resource: fileMetadata,
            media: media,
            fields: 'id'
        });

        const fileId = response.data.id;

        // Set file permissions to public
        await drive.permissions.create({
            fileId: fileId,
            requestBody: {
                role: 'reader',
                type: 'anyone'
            }
        });

        const link = `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;

        // Save to DB
        const certificate = new Certificate({ name, course, date, email, link });
        await certificate.save();

        res.send({ link });
    } catch (error) {
        console.error('Error uploading file to Google Drive:', error.response ? error.response.data : error.message);
        res.status(500).send('Internal Server Error');
    }
});

app.listen(5000, () => {
    console.log('Server started on port 5000');
});
