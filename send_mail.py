import email
import smtplib, ssl
import datetime
from datetime import date
from email import encoders
from email.mime.base import MIMEBase
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

def send_m(receiver):
    password = "buurtheet123!"
    subject = "Data Atlas"
    body = ("Script run automatically by PythonAnywhere @" + datetime.datetime.now().strftime("%d %B %Y, %H:%M:%S"))
    sender_email = "vivaldibewoners@gmail.com"

    # Create a multipart message and set headers
    message = MIMEMultipart()
    message["From"] = sender_email
    message["To"] = receiver
    message["Subject"] = subject
    message["Bcc"] = receiver  # Recommended for mass emails

    # Add body to email
    message.attach(MIMEText(body, "plain"))

    text = message.as_string()

    # Log in to server using secure context and send email
    context = ssl.create_default_context()
    with smtplib.SMTP_SSL("smtp.gmail.com", 465, context=context) as server:
        server.login(sender_email, password)
        server.sendmail(sender_email, receiver, text)
    
def send_multiple(receiver_emails):
    for receiver in receiver_emails:
        send_m(receiver)
    
# try:
#     receiver_emails = ["jasonraefon@hotmail.com","nino.atlassalesagency@gmail.com"]
#     send_multiple(receiver_emails)

#     # send_m("jasonraefon@hotmail.com")
#     print("Email sent successfully at: ", datetime.datetime.now())
# except Exception as e:
#     print(e)
#     print("Email NOT sent successfully at: ", date.today().strftime("%d %B %Y"))
