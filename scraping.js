const cheerio = require('cheerio')
const tableParser = require('cheerio-tableparser')
const axios = require('axios')
const superagent = require('superagent')
const creds = require('./atlas.json')

const werverList = ["Rosa de Kiefte","Ali Khaldi","Abdi Ali","Arjan Noordermeer",
                    "Brett Taument","Britt Gruntjes","Camille Montoux",
                    "Giovanni Melissant","Ismael El Hamouchi","Jelle van Eck","Jethro Swennen","Luke Hermes",
                    "Mathis Montoux","Max Scholsberg","Owen Maas","Quentin Booi",
                    "Simon Knotnerus","Thijs Bakker","Tim Chibanov",
                    "Wouter Wissema","Ferry Biesheuvel","Luc van der Vorm",
                    "Moos Minkes", "Carl Hendriks","Rick Kerkhoven","Luuc Marchand","Ian Hermes","Tommie Schotema",
                    "Charlotte Lagas","Boy Rath", "Grace van Houwelingen"]

const atlas = async (werverList) => {
    const types = ['algemeen', 'svhk']
    const algemeenData = await login(werverList,'algemeen')
    const svhkData = await login(werverList,'svhk')
    const allData = combineData(algemeenData,svhkData)
    const sortVariable = 'GOB'
    allData.sort((a, b) => {
        if(b[sortVariable] - a[sortVariable] === 0){
            return b['TOB'] - a['TOB']
        }
        return b[sortVariable] - a[sortVariable]
    })
    allData.forEach(werver => {
        werver['GOB'] = '€ '.concat(werver['GOB'].toFixed(2)).replace('.',',')
        werver['TOB'] = '€ '.concat(werver['TOB'].toFixed(2)).replace('.',',')
        werver['GIB'] = '€ '.concat(werver['GIB'].toFixed(2)).replace('.',',')
        werver['Uitval'] = (100*werver['Uitval']).toFixed(2).toString().concat(' %').replace('.',',')
    })
    return allData
}

const combineData = (data1, data2) => {
    const dataObj = {}
    data1.forEach(data => {
        dataObj[data['Naam']] = data
    })
    const newData = data2.map(data => {
        const name = data['Naam']
        const firstData = dataObj[name]
        let allData =  {
            'Naam': name,
            'TOB': data['TOB'] + firstData['TOB'],
            'Werkdagen': data['Werkdagen'] + firstData['Werkdagen'],
            'Donateurs': data['Donateurs'] + firstData['Donateurs'],
            'Bruto donateurs': data['Bruto donateurs'] + firstData['Bruto donateurs'],
        }
        if(allData['Werkdagen']>0) {
            allData['GOB'] = allData['TOB']/allData['Werkdagen']
        } else {
            allData['GOB'] = 0
        }
        allData['GIB'] = allData['TOB']/allData['Donateurs']
        allData['Uitval'] = (allData['Bruto donateurs'] - allData['Donateurs'])/allData['Bruto donateurs']
        return allData
    })
    return newData
}

const loopData = async (list, dict, type, agent) => {
    return Promise.all(list.map(async werver => {
        const id = dict[werver]
        const month = '03'
        const year = '2022'
        const urls = {
            'algemeen': `https://backstage.atlas-sales-agency.nl/admin/career/bonus/detail?user=${id}&start_month=${month}&start_year=${year}`,
            'svhk': `https://backstage.stichtingvanhetkind.nl/admin/career/bonus/detail?user=${id}&start_month=${month}&start_year=${year}`,
        }
        const response = await agent.get(urls[type])
        const data = await getData(werver, response)
        data['Type'] = type
        return data
    }))
}

const login = async (list,type) => {
    const loginURLs = {
        'algemeen': 'https://backstage.atlas-sales-agency.nl/login',
        'svhk': 'https://backstage.stichtingvanhetkind.nl/login',
    }
    const agent = superagent.agent()
    const url = loginURLs[type]
    const loginCreds = {
        'algemeen': {
            'username': 'mehdi@atlas-sales-agency.nl',
            'password': 'Atlaslions7',
        },
        'svhk': {
            'username': 'manager@atlassalesagency.nl',
            'password': '@tlas789',
        }
    }
    const csrf = await agent.get(url)
    const $ = cheerio.load(csrf.text)
    const token = $('input[name=_csrf_token]')[0].attribs.value
    await agent.post(url)
    .send({
        email: loginCreds[type]['username'],
        password: loginCreds[type]['password'],
        _csrf_token: token,
    })
    .set('Content-Type', 'application/x-www-form-urlencoded')
    let page
    if(type === 'algemeen'){
        page = await agent.get('https://backstage.atlas-sales-agency.nl/admin/career/bonus/detail?user=7377&start_month=02&start_year=2022')
    } else {
        page = await agent.get('https://backstage.stichtingvanhetkind.nl/admin/career/bonus/detail?user=7661&start_month=02&start_year=2022') 
    }
    let $$ = cheerio.load(page.text)
    let label
    if(type === 'algemeen') {
        label = "Rotterdam HQ ASA"
    } else {
        label = "Atlas Rotterdam"
    }
    let werverDict = {}
    $$(`optgroup[label="${label}"]`).find('option').each((i,option) => {
        werverDict[$(option).text()] = $(option)[0].attribs.value 
    })
    const allData = await loopData(list, werverDict, type, agent)
    return allData
} 

const getData = async (werverName,page) => {
    const $ = cheerio.load(page.text)
    const table = $('table[class="table table-bordered table-sm m-0"]')
    let columns = table.children('thead').text().replace(/^\s+|\s+$/gm,'')
    let items = {}
    let tableData = table.children('tbody').html()

    tableParser($)
    const verdTable = $('table[class="table table-bordered table-striped table-sm m-0"]').parsetable(false, false, true)
    let uitval = parseFloat(verdTable[1][5].replace('%','').replace(',','.').trim())
    if(!uitval){uitval = 0}
    let data = $('table[class="table table-bordered table-sm m-0"]').parsetable(false, false, true)
    const dates = data[0].slice(0,-3)
    const eenmalig = data[5].slice(0,-3)
    let projects = $('table[class="table table-bordered table-sm m-0"]').parsetable()[3]
    projects = projects.map(project => {
        if(project === 'Project' || project === '' || project === '&nbsp;') {
            return null
        }
        return project
    }).slice(0,-3)
    let symbols = $('table[class="table table-bordered table-sm m-0"]').parsetable()[1].map(item => item.replace('\n','').trim())
    symbols = symbols.map(item => {
        if(item === '<i class="fa fa-check text-success"></i>'){
            return 'success'
        } else if(item === '<i class="fa fa-exchange-alt text-warning"></i>'){
            return 'warning'
        } else if(item === '<i class="fa fa-times text-danger"></i>'){
            return 'danger'
        } else {
            return null
        }
    }).slice(0,-3)

    let bedragen = data[4].slice(0,-3)
    let salaris = data[7].slice(0,-3)

    let werkdagen = 0
    dates.forEach(item => {
        if(!(item === '' || item ==='Totaal')){
            werkdagen++
        }
    })

    let brutoDonateurs = 0
    projects.forEach(item => {
        if(item) {
            brutoDonateurs++
        }
    })

    bedragen = bedragen.map(item => parseFloat(item.replace('M ⨉ ','').replace(',','.')))
    salaris = salaris.map(item => parseFloat(item.replace('€\xa0','').replace(',','.')))
    let factor = -1
    for(let i=0;i<salaris.length;i++) {
        const sal = salaris[i]
        const tot = bedragen[i]
        if(tot && sal){
            factor = sal/tot 
            break
        }
    }

    let totEenmalig = 0
    for(let i=0;i<salaris.length;i++) {
        if(symbols[i]!='warning' && eenmalig[i] && salaris[i] && projects[i]) {
            brutoDonateurs -= 1
            totEenmalig += salaris[i]
        }
        
        if(dates[i] === 'Totaal') {
            bedragen[i] = null
        }
    }

    let tob = 0
    bedragen.forEach(bedrag => {
        if(bedrag > 15) {
            tob += factor*(bedrag-15)
        }
    })
    let donateurs = Math.round((100-uitval)*brutoDonateurs/100)
    const naUitval = parseFloat(verdTable[2][1].replace('€','').replace('.','').replace(',','.'))
    tob = (naUitval+tob - totEenmalig)/factor
    let gob = Math.round(100*tob/werkdagen)/100
    let gib = Math.round(100*tob/donateurs)/100
    if(tob === 0) {
        gob = 0
        gib = 0
    }
    if(!uitval && !(uitval===0)) {
        donateurs = 0
    }
    let allData = {
        'Naam': werverName,
        'GOB': gob,
        'TOB': tob,
        'Werkdagen': werkdagen,
        'Donateurs': donateurs,
        'Bruto donateurs': brutoDonateurs,
        'GIB': gib,
        'Uitval': uitval,
    }
    return allData
}

exports.atlas = (names) => atlas(names)
