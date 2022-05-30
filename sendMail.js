"use strict";
require('dotenv').config()
const { v4: uuidv4 } = require('uuid')
const nodemailer = require("nodemailer");

// async..await is not allowed in global scope, must use a wrapper
async function sendMail(emailData) {
    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
        host: "smtp-mail.outlook.com",
        port: 587,
        pool: true,
        secure: false, // true for 465, false for other ports
        auth: {
            user: process.env.EMAIL, // generated ethereal user
            pass: process.env.EMAIL_PW, // generated ethereal password
        },
        maxConnections: 1,
    });

    const addresses = {
        'rtm-hq': {
            address: 'Scheepmakershaven 27b, 3011 VA',
            place: 'Rotterdam',
            team: 'Rotterdam HQ'
        },
        'ams': {
            address: 'Rokin 32-1, 1012 KT',
            place: 'Amsterdam',
            team: 'Amsterdam',
        },
        'utr': {
            address: 'Sintjacobsstraat 205, 3511 BT',
            place: 'Utrecht',
            team: 'Utrecht',
        },
    }

    const makeEnum = (str) => {
        const projectArray = str.split(',').filter(project => project !== 'Stichting van het Kind')
        const lastProject = projectArray.length > 1 ? ' en '.concat(projectArray.pop()) : ''
        return projectArray.length > 0 ? projectArray.join(', ').concat(lastProject) : projectArray
    }

    // console.log(makeEnum(emailData.projects))

    // `<p>Beste [Kelly / Trust Marketing],<br/><br/>Graag zou ik namens Atlas Sales Agency [vestiging] aan de [adres] te [plaatsnaam] een gepersonaliseerde werverspas van [project(en)] (dikgedrute weglaten als het om SVHK gaat) willen bestellen voor [werver]. De geboortedatum van [voornaam werver] is [geboortedatum].<br/><br/>Een foto van [voornaam werver] is toegevoegd als bijlage.<br/><br/>Bij voorbaat dank.<br/><br/>Met vriendelijke groet,<br/>Nino Retel Helmrich<br/>Atlas Sales Agency</p>`



    const emailBody = `<p>Beste Trust Marketing,<br/><br/>Graag zou ik namens Atlas Sales Agency ${addresses[emailData.atlasLocation].team} aan de ${addresses[emailData.atlasLocation].address} te ${addresses[emailData.atlasLocation].place} een gepersonaliseerde werverspas ${`<b>van ${emailData.projects.length > 1 ? makeEnum(emailData.projects) : emailData.projects}</b>`} willen bestellen voor ${emailData.firstName + ' ' + emailData.lastName}. De geboortedatum van ${emailData.firstName} is ${emailData.birthday}.<br/><br/>Een foto van ${emailData.firstName} is toegevoegd als bijlage.<br/><br/>Bij voorbaat dank.<br/><br/>Met vriendelijke groet,<br/>Nino Retel Helmrich<br/>Atlas Sales Agency</p>`

    const emailBodySVHK = `<p>Beste Kelly,<br/><br/>Graag zou ik namens Atlas Sales Agency ${addresses[emailData.atlasLocation].team} aan de ${addresses[emailData.atlasLocation].address} te ${addresses[emailData.atlasLocation].place} een gepersonaliseerde werverspas van Stichting van het Kind willen bestellen voor ${emailData.firstName + ' ' + emailData.lastName}. De geboortedatum van ${emailData.firstName} is ${emailData.birthday}.<br/><br/>Een foto van ${emailData.firstName} is toegevoegd als bijlage.<br/><br/>Bij voorbaat dank.<br/><br/>Met vriendelijke groet,<br/>Nino Retel Helmrich<br/>Atlas Sales Agency</p>`

    const receiverAdresses = {
        svhk: 'kelly@stichtingvanhetkind.nl',
        trust: 'bestellingen@trustmarketing.nl'
    }
    try {
        const projects = emailData.projects.split(',')
        console.log(projects.includes('Stichting van het Kind'))
        console.log(projects.length)
        if (projects.includes('Stichting van het Kind') && projects.length === 1) {
            transporter.sendMail({
                from: 'jasonraefon@hotmail.com', // sender address
                to: "jasonraefon@hotmail.com", // list of receivers
                subject: "Hello ✔", // Subject line
                // text: "Hello world?", // plain text body
                html: emailBodySVHK, // html body
                attachments: emailData.photo ? [
                    {
                        filename: `${emailData.photo.originalname}`,
                        path: `./uploads/images/${emailData.photo.originalname}`,
                        cid: uuidv4(),
                    }
                ] : ''
            });
            console.log('svhk email sent')
        } else if (projects.includes('Stichting van het Kind') && projects.length > 1) {
            const emails = [emailBody, emailBodySVHK]
            console.log(emails)
            transporter.sendMail({
                from: 'jasonraefon@hotmail.com', // sender address
                to: "jasonraefon@hotmail.com", // list of receivers
                subject: "Hello ✔", // Subject line
                // text: "Hello world?", // plain text body
                html: emailBody, // html body
                attachments: emailData.photo ? [
                    {
                        filename: `${emailData.photo.originalname}`,
                        path: `./uploads/images/${emailData.photo.originalname}`,
                        cid: uuidv4(),
                    }
                ] : ''
            });
            transporter.sendMail({
                from: 'jasonraefon@hotmail.com', // sender address
                to: "jasonraefon@hotmail.com", // list of receivers
                subject: "Hello ✔", // Subject line
                // text: "Hello world?", // plain text body
                html: emailBodySVHK, // html body
                attachments: emailData.photo ? [
                    {
                        filename: `${emailData.photo.originalname}`,
                        path: `./uploads/images/${emailData.photo.originalname}`,
                        cid: uuidv4(),
                    }
                ] : ''
            });
        } else {
            transporter.sendMail({
                from: 'jasonraefon@hotmail.com', // sender address
                to: "jasonraefon@hotmail.com", // list of receivers
                subject: "Hello ✔", // Subject line
                // text: "Hello world?", // plain text body
                html: emailBody, // html body
                attachments: emailData.photo ? [
                    {
                        filename: `${emailData.photo.originalname}`,
                        path: `./uploads/images/${emailData.photo.originalname}`,
                        cid: uuidv4(),
                    }
                ] : ''
            });
            console.log('email sent')
        }
        return 'email sent successfully !'
    } catch (err) {
        return err
    }



    // console.log("Message sent: %s", info.messageId);
    // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

    // Preview only available when sending through an Ethereal account
    // console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    // Preview URL: https://ethereal.email/message/WaQKMgKddxQDoou...
}

exports.sendMail = (data) => sendMail(data)