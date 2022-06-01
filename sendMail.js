"use strict";
require('dotenv').config()
const { v4: uuidv4 } = require('uuid')
const nodemailer = require("nodemailer");

// async..await is not allowed in global scope, must use a wrapper
async function sendMail(emailData) {
    // create reusable transporter object using the default SMTP transport
    let transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
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

    const birthdayArray = emailData.birthday.split('-').reverse()
    const emailBirthday = birthdayArray.join('-')

    const emailBody = `<p>Beste Trust Marketing,<br/><br/>Graag zou ik namens Atlas Sales Agency ${addresses[emailData.atlasLocation].team} aan de ${addresses[emailData.atlasLocation].address} te ${addresses[emailData.atlasLocation].place} een gepersonaliseerde werverspas ${`<b>van ${emailData.projects.length > 1 ? makeEnum(emailData.projects) : emailData.projects}</b>`} willen bestellen voor ${emailData.firstName + ' ' + emailData.lastName}. De geboortedatum van ${emailData.firstName} is ${emailBirthday}.<br/><br/>Een foto van ${emailData.firstName} is toegevoegd als bijlage.<br/><br/>Bij voorbaat dank.<br/><br/>Met vriendelijke groet,<br/>Nino Retel Helmrich<br/>Atlas Sales Agency</p>`

    const emailBodySVHK = `<p>Beste Kelly,<br/><br/>Graag zou ik namens Atlas Sales Agency ${addresses[emailData.atlasLocation].team} aan de ${addresses[emailData.atlasLocation].address} te ${addresses[emailData.atlasLocation].place} een gepersonaliseerde werverspas van Stichting van het Kind willen bestellen voor ${emailData.firstName + ' ' + emailData.lastName}. De geboortedatum van ${emailData.firstName} is ${emailBirthday}.<br/><br/>Een foto van ${emailData.firstName} is toegevoegd als bijlage.<br/><br/>Bij voorbaat dank.<br/><br/>Met vriendelijke groet,<br/>Nino Retel Helmrich<br/>Atlas Sales Agency</p>`

    const receiverAdresses = {
        svhk: 'kelly@stichtingvanhetkind.nl',
        trust: 'bestellingen@trustmarketing.nl'
    }
    try {
        const projects = emailData.projects.split(',')
        if (projects.includes('Stichting van het Kind') && projects.length === 1) {
            transporter.sendMail({
                from: 'faciliteiten.atlasssalesagency@gmail.com', // sender address
                // to: 'jasonraefon@hotmail.com', // list of receivers
                to: 'kelly@stichtingvanhetkind.nl', // list of receivers
                subject: "Aanvraag werverspas", // Subject line
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
            transporter.sendMail({
                from: 'faciliteiten.atlasssalesagency@gmail.com', // sender address
                // to: 'jasonraefon@hotmail.com', // list of receivers
                to: 'bestellingen@trustmarketing.nl', // list of receivers
                subject: "Aanvraag werverspas(sen)", // Subject line
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
                from: 'faciliteiten.atlasssalesagency@gmail.com', // sender address
                // to: 'jasonraefon@hotmail.com', // list of receivers
                to: 'kelly@stichtingvanhetkind.nl', // list of receivers
                subject: "Aanvraag werverspas", // Subject line
                html: emailBodySVHK, // html body
                attachments: emailData.photo ? [
                    {
                        filename: `${emailData.photo.originalname}`,
                        path: `./uploads/images/${emailData.photo.originalname}`,
                        cid: uuidv4(),
                    }
                ] : ''
            });
            console.log('Emails sent !')
        } else {
            transporter.sendMail({
                from: 'faciliteiten.atlasssalesagency@gmail.com', // sender address
                // to: 'jasonraefon@hotmail.com', // list of receivers
                to: 'bestellingen@trustmarketing.nl', // list of receivers
                subject: "Aanvraag werverspas(sen)", // Subject line
                html: emailBody, // html body
                attachments: emailData.photo ? [
                    {
                        filename: `${emailData.photo.originalname}`,
                        path: `./uploads/images/${emailData.photo.originalname}`,
                        cid: uuidv4(),
                    }
                ] : ''
            });
            console.log('Email sent !')
        }
        return 'email sent successfully !'
    } catch (err) {
        return err
    }
}

exports.sendMail = (data) => sendMail(data)