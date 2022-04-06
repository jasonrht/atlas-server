import requests
import datetime as dt
from bs4 import BeautifulSoup as bs
import traceback
import pandas as pd
import math
from operator import itemgetter
from oauth2client.service_account import ServiceAccountCredentials
import gspread
import json
from pymongo import MongoClient
import uuid
from dotenv import load_dotenv
import os

load_dotenv()

def werver_dict(page):
	i=0
	wervers_ids = []
	wervers = {}
	wervers_list = bs(page,"html.parser").find_all("option")
	for werver_id in wervers_list:
		wervers_list[i] = werver_id.text.strip()
		wervers_ids.append(werver_id.get("value"))
		wervers[wervers_list[i]] = wervers_ids[i]
		i+=1
	return wervers

def get_name(id, wervers):
    # returns name of werver by werver id
    for key,value in wervers.items():
        if id == value:
            return key 
    return "key does not exist"

def get_data(werver,content):
    wervers = werver_dict(content)
    data_page = bs(content, "html.parser")
    df = pd.read_html(content)
    data_werver = df[1]
    data_werver.rename(columns={"Unnamed: 0": "col1","Unnamed: 2":"column_three"},inplace=True)
    project_col = data_werver["Project"] 

    trs = data_page.find_all("table")[1].find_all("tr")[1:-3] # correctie voor laatste rijen
    sal_periode = data_werver["Na uitval deze periode"]
    eenmalig_col = data_werver["Eenmalig"]
    project_col = data_werver["Project"] 

    # last_row = data_page.find_all("table")[1].find_all('tr')[-1]
    # tds = last_row.find_all("td", attrs={"class":"number"})
    # tot = float(tds[1].text.replace("M","").replace("⨉","").replace(",",".").strip())
    # sal = float(tds[5].text.replace("€\xa0","").replace(",",".").strip())
    # if float(tds[1].text.replace("M","").replace("⨉","").replace(",",".").strip()) > 0:
    #     factor = sal/tot
    # else:
    #     factor = -1

    factor = -1
    i=0
    for tr in trs:
        if isinstance(project_col[i], str):
            row = tr.find("td", attrs={"class": "number"})
            if not(row is None):
                tds = tr.find_all("td", attrs={"class":"number"})
                tot = tds[0].text.replace("M","").replace("⨉","").replace(",",".").strip()
                sal = tds[3].text.replace("€\xa0","").replace(",",".").strip()
                if not(tot=="") and not(sal==""):
                    factor = float(sal)/float(tot)
                    break
        i+=1
    werkdagen = 0
    tot_eenmalig = 0
    bruto_don = 0
    tob = 0
    i=0
    for tr in trs: # per rij data extraheren
        date = tr.find("td", attrs={"class":"align-middle"})
        if not(date is None):
            werkdagen += 1

        switch_sym = tr.find("i", attrs={"class": "fa fa-exchange-alt text-warning"})
        if isinstance(project_col[i], str):
            bruto_don += 1
            if (switch_sym is None) and not(pd.isnull(eenmalig_col[i])) and not(math.isnan(float(sal_periode[i]))):
                bruto_don -= 1
                tot_eenmalig += float(sal_periode[i])
            # inschrijfbedrag > 15
            row = tr.find("td", attrs={"class": "number"})
            if not(row is None):
                bedrag = row.text.replace("M","").replace("⨉","").replace(",",".").strip()
                if not(bedrag==""):
                    f_bedrag = float(bedrag)
                    if f_bedrag>15:
                        tob += factor*(f_bedrag-15)
        i+=1 

    tot_eenmalig = tot_eenmalig/100 # omzetten centen naar euros
    verd_werver = df[0]
    na_uitval = verd_werver["Na uitval deze periode"]
    # totaal opgehaald bedrag (TOB)
    tob1 = na_uitval[0].replace("€\xa0","").replace(".","").replace(",",".").strip()
    tob += (float(tob1)-tot_eenmalig)

    # gemiddeld opgehaald 
    if werkdagen>0:
        gob = tob/float(werkdagen)
    else:
        gob = 0

    if verd_werver["Salaris deze periode"][4] == "-":
        uitval = 0
    else:
        uitval = float(verd_werver["Salaris deze periode"][4].replace(" %", "").replace(",","."))
    netto_don = int(round(bruto_don*(1-(uitval/100))))
    if netto_don == 0:
        gib = 0 
    else:
        gib = tob/float(netto_don)

    variables = {
        "Naam": get_name(werver, wervers),
        "TOB": round(tob/factor,2),
        "GOB": round(gob,2),
        "Netto donateurs": netto_don,
        "Werkdagen": werkdagen,
        "Bruto donateurs": bruto_don,
        "GIB": round(gib,2),
        "Uitval": round(100*uitval,2)
    }
    return variables

def get_links(type, wervers, ids, month, year):
    type.lower()
    links = []
    werver_ids = ids
    for i in range(len(wervers)):
        user_id = werver_ids[i]
        if type == "algemeen":
            link = f"https://backstage.atlas-sales-agency.nl/admin/career/bonus/detail?user={user_id}&start_month={month}&start_year={year}"
            links.append(link)     
        else:
            link = f"https://backstage.stichtingvanhetkind.nl/admin/career/bonus/detail?user={user_id}&start_month={month}&start_year={year}"  
            links.append(link)
    return links

def login(type, url):
    login_creds = {
        "email": os.getenv('ALGEMEEN_USERNAME'),
        "password": os.getenv('ALGEMEEN_PW'),
    }

    svhk_login_creds = {
        "email": os.getenv('SVHK_USERNAME'),
        "password": os.getenv('SVHK_PW')
    }

    all_login_creds = [login_creds, svhk_login_creds]

    s = requests.session()
    login_page = s.get(url)
    login_page_bs = bs(login_page.text, "html.parser")
    csrf_token = login_page_bs.find("input", attrs={"name":"_csrf_token"}).get("value")
    if type == 0:
        login_creds = all_login_creds[0]
    else:
        login_creds = all_login_creds[1]
    login_creds["_csrf_token"] = csrf_token
    s.post(url, data=login_creds)
    return s

def tot_data(data1, data2):
    all_data = []
    for i in range(len(data1)):
        variables = ["Werkdagen", "Netto donateurs", "Bruto donateurs"]
        tot_data = {
            "Naam": data1[i]["Naam"]
        }
        tot_data["TOB"] = round(data1[i]["TOB"]+data2[i]["TOB"],2)
        for var in variables:
            tot_data[var] = data1[i][var] + data2[i][var]

        if tot_data["Bruto donateurs"] == 0:
            tot_data["Uitval"] = 0 
        else:	
            tot_data["Uitval"] = round((tot_data["Bruto donateurs"]-tot_data["Netto donateurs"])/tot_data["Bruto donateurs"],3)
        if tot_data["Netto donateurs"] == 0:
            tot_data["GIB"] = 0
        else:
            tot_data["GIB"] = round(tot_data["TOB"]/tot_data["Netto donateurs"],2)
        if tot_data["Werkdagen"] == 0:
            tot_data["GOB"] = 0 
        else:
            tot_data["GOB"] = round(tot_data["TOB"]/tot_data["Werkdagen"],2)
        all_data.append(tot_data)
        i+=1
        sorted_data = sorted(all_data, key=itemgetter("TOB"), reverse=True)
    return sorted_data

def poule_data(wervers,poule_name,df):
    """Takes list of wervers as input and returns a new pandas
        dataframe with the names of the given wervers and the name of 
        the poule they belong to."""
    tob_first = ['sp_data', 'st_data', 'promotor_data']
    df_rows = df.values.tolist()
    werver_list = []
    for i in range(len(df_rows)):
        werver = df_rows[i]
        if wervers.count(werver[0])==1: # Be aware of bug werver[0]|werver[1]
            werver_list.append(werver)
        i+=1
    col_names = ["Naam","TOB","GOB","Werkdagen","Donateurs", 
                    "Bruto donateurs","GIB","Uitval"]
    new_df = pd.DataFrame(werver_list,columns=col_names)
    
    new_df['TOB'] = new_df['TOB'].apply(lambda x: abs(x))

    if tob_first.count(poule_name) != 1:
        gob = new_df.pop("GOB")
        new_df.insert(1,"GOB",gob)
        new_df.sort_values(by=["GOB"], ascending=False, inplace=True)

    new = new_index(new_df)
    new_df.insert(0,"",new)
    new_df.set_index(pd.Index(new),inplace=True)

    print(f'{poule_name} => \n{new_df}')
    return new_df

def apex_data(df):
    """Takes in a pandas dataframe and returns a new dataframe with 
        all the members of the Atlas APEX poule in it."""
    apex_wervers = ["Britt Gruntjes","Camille Montoux","Jethro Swennen","Max Scholsberg"]
    df_rows = df.values.tolist()
    werver_list = []
    j=1
    for i in range(len(df_rows)):
        werver = df_rows[i]
        if apex_wervers.count(werver[0])==1: # Be aware of bug here !
            werver_list.append(werver)
            j+=1
        i+=1

    sorted_wervers = sorted(werver_list,key=itemgetter(2),reverse=True)

    col_names = ["Naam","TOB","GOB","Werkdagen","Donateurs", 
                    "Bruto donateurs","GIB","Uitval"]
    new_df = pd.DataFrame(sorted_wervers,columns=col_names)
    new_df['TOB'] = new_df['TOB'].apply(lambda x: abs(x))
    gob = new_df.pop("GOB")
    new_df.insert(1,"GOB",gob)
    new = new_index(new_df)
    new_df.insert(0,"",new)
    new_df.set_index(pd.Index(new),inplace=True)
    print(f'Apex data => \n{new_df}')
    return new_df

def get_sheet(wks):
	"""This function connects with a specific Google Spreadsheet and 
		returns the spreadsheet"""
	scope = ['https://spreadsheets.google.com/feeds','https://www.googleapis.com/auth/spreadsheets',
			'https://www.googleapis.com/auth/drive.file','https://www.googleapis.com/auth/drive']
	creds = ServiceAccountCredentials.from_json_keyfile_name('atlas.json', scope)
	client = gspread.authorize(creds)
	sheet = client.open("LeaderboardsAtlas").worksheet(wks)
	return sheet

def to_spreadsheet(df,corner,wks):
	"""Upload a pandas dataframe to a specific corner
		of a worksheet."""
	sheet = get_sheet(wks)
	sheet.update(corner, [df.columns.values.tolist()] + df.values.tolist())
	# sheet.batch_clear("")

def new_index(df):
    tobs = df.loc[:,"GOB"].values
    prev_tob = tobs[0]
    new = [1]
    # df.set_index("Naam", inplace=True)
    i=2
    for t in tobs[1:]:
        tob = tobs[i-1]
        if  tob == prev_tob:
            new.append("")
        else:
            new.append(i)
        prev_tob = tob
        i+=1
    return new
    
def upload_data(df,coll):
    mongo_uri = os.getenv('MONGO_URI')
    cluster = MongoClient(mongo_uri, uuidRepresentation="standard")
    db = cluster["myFirstDatabase"] 
    collection = db[f"{coll}models"]

    df['TOB'] = df['TOB'].apply(lambda x: abs(x))

    euro_cols = ['TOB','GOB','GIB']

    for col in euro_cols:
        df[col] = df[col].apply(lambda x: '{:.2f}'.format(x))
        df[col] = df[col].apply(lambda x: f'€ {x}')
        df[col] = df[col].apply(lambda x: x.replace('.',','))

    df['Uitval'] = df['Uitval'].apply(lambda x: f'{round(x*100,2)} %')
    df['Uitval'] = df['Uitval'].apply(lambda x: x.replace('.',','))

    data_dict = df.to_dict("split")
    post = {"_id": uuid.uuid4(), "date": dt.datetime.now()}
    post = post | data_dict 
    collection.insert_one(post)

def get_dates():
    response = bs(requests.get('http://localhost:3001/getDates').text, 'html.parser')
    res_dict = json.loads(str(response))
    if len(res_dict)<=0:
        t = dt.datetime.now()
        month = t.month
        year = t.year
        if month < 10:
            month = '0'+str(month)
        else: 
            month = str(month)
        return {'selectedMonth': month, 'selectedYear': year}

    if res_dict['selectedMonth'] < 10:
        res_dict['selectedMonth'] = '0'+str(res_dict['selectedMonth'])
    else:
        res_dict['selectedMonth'] = str(res_dict['selectedMonth'])
    res_dict['selectedYear'] = str(res_dict['selectedYear'])
    res_dict['backup'] = str(res_dict['backup'])
    return res_dict

def get_wervers():
    '''Function that return a tuple with lists of werver names.'''
    res = requests.get('https://atlas-website-backend.herokuapp.com/get-wervers').json()
    sp = []
    p = []
    st = []
    for werver in res:
        status = werver['status']
        if status == 'SP':
            sp.append(werver['name'])
        elif status == 'P':
            p.append(werver['name'])
        elif status == 'ST':
            st.append(werver['name'])
    return sp, p, st



def run(wervers):
    url = "https://backstage.atlas-sales-agency.nl/login"
    werver_url = "https://backstage.atlas-sales-agency.nl/admin/career/bonus/detail?user=7377&start_month=01&start_year=2022"
    svhk_login_url = "https://backstage.stichtingvanhetkind.nl/login"
    werver_url_svhk = "https://backstage.stichtingvanhetkind.nl/admin/career/bonus/detail?user=7661&start_month=01&start_year=2022"
    login_urls = [url, svhk_login_url]
    urls = [werver_url, werver_url_svhk]
    names = ["Algemeen", "SVHK"]
    # dates = get_dates()
    dates = {
        'selectedMonth': '04',
        'selectedYear': 2022,
        'backup': 'False',
    }
    month = dates['selectedMonth']
    year = dates['selectedYear']
                
    try:
        t1 = dt.datetime.now()
        
        print('Fetching data ...')
        data_algemeen = []
        data_svhk = []
        data = [data_algemeen,data_svhk]
        for i, url in enumerate(login_urls):
            s = login(i, url)
            all_wervers = werver_dict(s.get(urls[i]).text)
            werver_ids = []
            for werver in wervers:
                werver_ids.append(all_wervers[werver])
            links = get_links(names[i].lower(), wervers, werver_ids, month, year)
            for j,link in enumerate(links):
                r = s.get(link)
                data[i].append(get_data(werver_ids[j],r.text))
            s.close()
        all_data = tot_data(data[0], data[1])
        df = pd.DataFrame(all_data)
        gob = df.pop("GOB")
        df.insert(2,"GOB",gob)
        gib = df.pop("GIB")
        df.insert(6,"GIB",gib)
        new = new_index(df)
        df.set_index(pd.Index(new),inplace=True)

        t2 = dt.datetime.now()
        print(f'Data fetched in {t2-t1}')

        print(f"{t2} => \n{df}")

        apex_df = apex_data(df)

        papyrus_wervers = ["Jelle van Eck", "Arjan Noordermeer"]
        papyrus_df = poule_data(papyrus_wervers,"papyrus_data", df)

        hermes_wervers = ["Brett Taument","Quentin Booi","Luke Hermes","Luuc Marchand","Ian Hermes"]
        hermes_df = poule_data(hermes_wervers,"hermes_data", df)

        swennen_wervers = ["Rosa de Kiefte""Owen Maas","Simon Knotnerus","Jethro Swennen","Luc van der Vorm",
                            "Boy Rath"]
        swennen_df = poule_data(swennen_wervers,"swennen_data", df)

        izzy_wervers = ["Ismael El Hamouchi","Willemijn Renzen",'Charlotte Lagas']
        izzy_df = poule_data(izzy_wervers,"izzy_data",df)

        sp, promotors , st = get_wervers() 
        sp_df = poule_data(sp, "sp_data", df)
        promotors_df = poule_data(promotors, "promotor_data", df)
        st_df = poule_data(st, "st_data", df)

        # try:
        #     print('Uploading data to google spreadsheets ...')
        #     to_spreadsheet(papyrus_df,"B3","Nino's Poule Leaderboard")
        #     to_spreadsheet(swennen_df,"B3","Jethro's Poule Leaderboard")
        #     to_spreadsheet(hermes_df,"B3","Luke & Ian's Poule Leaderboard")
        #     to_spreadsheet(apex_df,"B3","Atlas APEX LeaderboardDec")
        #     to_spreadsheet(izzy_df,"B3","Ismael's Poule Leaderboard")
        #     to_spreadsheet(sp_df,"B3","Leaderboard april 2022")
        #     to_spreadsheet(promotors_df,"B26","Leaderboard april 2022")
        #     to_spreadsheet(st_df,"B33","Leaderboard april 2022")

        #     print("Data upload to spreadsheet success !")
        # except Exception as e:
        #     print(e)
        #     print('Failed to upload to spreadsheets !')

        df.insert(0,"Nr.",new)
        gob2 = df.pop('GOB')
        df.insert(2,'GOB',gob2)
        df.sort_values(by='GOB', ascending=False, inplace=True)
        index = new_index(df)
        df.set_index(pd.Index(index),inplace=True)

        print(f'df: \n {df}')

        try:
            if dates['backup'] == 'True':
                upload_data(df, 'backup')
            else:
                print('uploading data to mongoDB ...')
                upload_data(df,"algemeen")
                upload_data(apex_df,"apex")
                upload_data(papyrus_df,"papyrus")
                upload_data(hermes_df,"hermes")
                upload_data(swennen_df,"swennen")
                upload_data(izzy_df,"izzy")
                upload_data(sp_df,"sp")
                upload_data(promotors_df,"promotors")
                upload_data(st_df, "st")
                print('data upload success !')
        except Exception as e:
            print(e)
            print('data upload failed ...')



        t3 = dt.datetime.now()
        print(f"Script run success !!! ({dt.datetime.now()})")
        print(f"Time to run script: {t3-t1}")
        # try:
        #     sm.send_m("jasonraefon@hotmail.com")
        #     print('Email sent successfully !')
        # except Exception as e:
        #     print(e)
        #     print('Failed to send email !')                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   6                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           
        return data
    except Exception:
        print(traceback.format_exc())
        print("Script run fail !")


wervers = ["Rosa de Kiefte","Ali Khaldi","Arjan Noordermeer",
            "Brett Taument","Britt Gruntjes","Camille Montoux","David Migo",
            "Ismael El Hamouchi","Jelle van Eck","Jethro Swennen","Luke Hermes",
            "Mathis Montoux","Max Scholsberg","Owen Maas","Quentin Booi",
            "Simon Knotnerus","Ted Hulshof","Thijs Bakker","Tim Chibanov",
            "Willemijn Renzen","Wijnand Hoofs","Wouter Wissema","Ferry Biesheuvel","Luc van der Vorm",
            "Moos Minkes","Rick Kerkhoven","Luuc Marchand","Ian Hermes",
            "Charlotte Lagas","Grace van Houwelingen","Josephine Lagas","Roderick Renzen"]  

test_wervers = ["Ismael El Hamouchi","Rosa de Kiefte"]
run(wervers) # run script

# print(get_wervers())



