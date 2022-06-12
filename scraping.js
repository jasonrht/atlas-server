const cheerio = require('cheerio')
const tableParser = require('cheerio-tableparser')
const axios = require('axios')
const superagent = require('superagent')
const creds = require('./atlas.json')
const { GoogleSpreadsheet } = require('google-spreadsheet');
const dfd = require('danfojs-node')

const atlas = async () => {
    const werverDict = await getWervers()
    const werverList = werverDict.map(werver => werver.name)
    // const werverList = ['Luc van der Vorm', 'Arjan Noordermeer']
    const algemeenData = await login(werverList, 'algemeen')
    const svhkData = await login(werverList, 'svhk')
    const allData = combineData(algemeenData, svhkData)
    const sortVariable = 'GOB'
    allData.sort((a, b) => {
        if (b[sortVariable] - a[sortVariable] === 0) {
            return b['TOB'] - a['TOB']
        }
        return b[sortVariable] - a[sortVariable]
    })
    allData.forEach(werver => {
        werver['TOB'] = '€ '.concat(werver['TOB'].toFixed(2)).replace('.', ',')
        werver['GIB'] = '€ '.concat(werver['GIB'].toFixed(2)).replace('.', ',')
        werver['GOB'] = '€ '.concat(werver['GOB'].toFixed(2)).replace('.', ',')
        werver['Uitval'] = (100 * werver['Uitval']).toFixed(2).toString().concat(' %').replace('.', ',')
    })
    // toSpreadsheet(werverDict, allData)
    const df = new dfd.DataFrame(allData)
    df.sortValues('TOB', { inplace: true, ascending: false })
    df.resetIndex({ inplace: true })
    df.print()
    return df
}

const getWervers = async () => {
    const response = await axios.get('https://atlas-website-backend.herokuapp.com/get-wervers')
    const wervers = response.data.map(werver => {
        return {
            name: werver.name,
            status: werver.status,
            poule: werver.poule,
        }
    })
    return wervers
}

const newIndex = (data, wervers) => {
    let prev = data[0]
    let newData = [Object.assign({ 'Nr.': 1 }, prev)]
    let i = 2
    for (let werver of data.slice(1, data.length)) {
        console.log(wervers.includes(werver['Naam']))
        if (wervers.includes(werver['Naam'])) {
            let gob = prev['GOB']
            if (werver['GOB'] === gob) {
                newData.push(Object.assign({ 'Nr.': '' }, werver))
            } else {
                newData.push(Object.assign({ 'Nr.': i }, werver))
            }
            prev = werver
            i++
        }
    }
    console.log(newData)
    return newData
}

const toSpreadsheet = async (wervers, data) => {
    const sp = wervers.map(werver => {
        if (werver.status === 'SP') {
            return werver.name
        }
    })
    const p = wervers.map(werver => {
        if (werver.status === 'P') {
            return werver.name
        }
    })
    const st = wervers.map(werver => {
        if (werver.status === 'ST') {
            return werver.name
        }
    })
    const poules = wervers.map(werver => {
        if (werver.poule !== '-') {
            return werver
        }
    })

    const werverList = await getWervers()
    const spList = wervers.filter(werver => {
        return werver.status === 'SP'
    })
    const spData = data.filter(werver => {
        console.log(werver)
        return sp.includes(werver['Naam'])
    })
    console.log(spData)

    const doc = new GoogleSpreadsheet('1WDWZlrIYf6zHyTHNV6EN9gkR8bkF9E8qP_5SxPbjGrI')
    await doc.useServiceAccountAuth({
        client_email: creds.client_email,
        private_key: creds.private_key
    })
    await doc.loadInfo()
    const sheet = doc.sheetsByIndex[1]
    const loadCells = await sheet.loadCells('B4:J23')
    for (let i = 0; i < spData.length; i++) {
        const index = sheet.getCell(i + 3, 1)
        const naam = sheet.getCell(i + 3, 2)
        const tob = sheet.getCell(i + 3, 3)
        const gob = sheet.getCell(i + 3, 4)
        const gib = sheet.getCell(i + 3, 8)
        const werkdagen = sheet.getCell(i + 3, 5)
        const donateurs = sheet.getCell(i + 3, 6)
        const brutoDonateurs = sheet.getCell(i + 3, 7)
        const uitval = sheet.getCell(i + 3, 9)

        index.value = spData[i]['Nr.']
        naam.value = spData[i]['Naam']
        tob.value = spData[i]['TOB']
        gob.value = spData[i]['GOB']
        werkdagen.value = spData[i]['Werkdagen']
        gib.value = spData[i]['GIB']
        donateurs.value = spData[i]['Donateurs']
        brutoDonateurs.value = spData[i]['Bruto donateurs']
        uitval.value = spData[i]['Uitval']
    }
    sheet.saveUpdatedCells()
}

const combineData = (data1, data2) => {
    const dataObj = {}
    data1.forEach(data => {
        dataObj[data['Naam']] = data
    })
    const newData = data2.map(data => {
        const name = data['Naam']
        const firstData = dataObj[name]
        let allData = {
            'Naam': name,
            'TOB': data['TOB'] + firstData['TOB'],
            'Werkdagen': data['Werkdagen'] + firstData['Werkdagen'],
            'Donateurs': data['Donateurs'] + firstData['Donateurs'],
            'Bruto donateurs': data['Bruto donateurs'] + firstData['Bruto donateurs'],
        }
        if (allData['Werkdagen'] > 0) {
            allData['GOB'] = allData['TOB'] / allData['Werkdagen']
        } else {
            allData['GOB'] = 0
        }
        allData['GIB'] = allData['TOB'] / allData['Donateurs']
        allData['Uitval'] = (allData['Bruto donateurs'] - allData['Donateurs']) / allData['Bruto donateurs']
        return allData
    })
    return newData
}

const loopData = async (list, dict, type, agent) => {
    return Promise.all(list.map(async werver => {
        const id = dict[werver]
        const month = '06'
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

const login = async (list, type) => {
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
    if (type === 'algemeen') {
        page = await agent.get('https://backstage.atlas-sales-agency.nl/admin/career/bonus/detail?user=7377&start_month=02&start_year=2022')
    } else {
        page = await agent.get('https://backstage.stichtingvanhetkind.nl/admin/career/bonus/detail?user=7661&start_month=02&start_year=2022')
    }
    let $$ = cheerio.load(page.text)
    let label
    if (type === 'algemeen') {
        label = "Rotterdam HQ ASA"
    } else {
        label = "Atlas Rotterdam"
    }
    let werverDict = {}
    $$(`optgroup[label="${label}"]`).find('option').each((i, option) => {
        werverDict[$(option).text()] = $(option)[0].attribs.value
    })
    const allData = await loopData(list, werverDict, type, agent)
    return allData
}

const getData = async (werverName, page) => {
    const $ = cheerio.load(page.text)
    const table = $('table[class="table table-bordered table-sm m-0"]')
    let columns = table.children('thead').text().replace(/^\s+|\s+$/gm, '')
    let items = {}
    let tableData = table.children('tbody').html()

    tableParser($)
    const verdTable = $('table[class="table table-bordered table-striped table-sm m-0"]').parsetable(false, false, true)
    let uitval = parseFloat(verdTable[1][5].replace('%', '').replace(',', '.').trim())
    if (!uitval) { uitval = 0 }
    let data = $('table[class="table table-bordered table-sm m-0"]').parsetable(false, false, true)
    const dates = data[0].slice(0, -3)
    const eenmalig = data[5].slice(0, -3)
    let projects = $('table[class="table table-bordered table-sm m-0"]').parsetable()[3]
    projects = projects.map(project => {
        if (project === 'Project' || project === '' || project === '&nbsp;') {
            return null
        }
        return project
    }).slice(0, -3)
    let symbols = $('table[class="table table-bordered table-sm m-0"]').parsetable()[1].map(item => item.replace('\n', '').trim())
    symbols = symbols.map(item => {
        if (item === '<i class="fa fa-check text-success"></i>') {
            return 'success'
        } else if (item === '<i class="fa fa-exchange-alt text-warning"></i>') {
            return 'warning'
        } else if (item === '<i class="fa fa-times text-danger"></i>') {
            return 'danger'
        } else {
            return null
        }
    }).slice(0, -3)

    let bedragen = data[4].slice(0, -3)
    let salaris = data[7].slice(0, -3)

    let werkdagen = 0
    dates.forEach(item => {
        if (!(item === '' || item === 'Totaal')) {
            werkdagen++
        }
    })

    let brutoDonateurs = 0
    projects.forEach(item => {
        if (item) {
            brutoDonateurs++
        }
    })

    bedragen = bedragen.map(item => parseFloat(item.replace('M ⨉ ', '').replace(',', '.')))
    salaris = salaris.map(item => parseFloat(item.replace('€\xa0', '').replace(',', '.')))
    let factor = -1
    for (let i = 0; i < salaris.length; i++) {
        const sal = salaris[i]
        const tot = bedragen[i]
        if (tot && sal && tot <= 15) {
            factor = sal / tot
            break
        }
    }

    let totEenmalig = 0
    for (let i = 0; i < salaris.length; i++) {
        if (symbols[i] != 'warning' && eenmalig[i] && salaris[i] && projects[i]) {
            brutoDonateurs -= 1
            totEenmalig += salaris[i]
        }

        if (dates[i] === 'Totaal') {
            bedragen[i] = null
        }
    }

    let tob = 0
    bedragen.forEach(bedrag => {
        if (bedrag > 15) {
            tob += factor * (bedrag - 15)
        }
    })
    let donateurs = Math.round((100 - uitval) * brutoDonateurs / 100)
    const naUitval = parseFloat(verdTable[2][1].replace('€', '').replace('.', '').replace(',', '.'))
    tob = (naUitval + tob - totEenmalig) / factor
    let gob = Math.round(100 * tob / werkdagen) / 100
    let gib = Math.round(100 * tob / donateurs) / 100
    if (tob === 0) {
        gob = 0
        gib = 0
    }
    if (!uitval && !(uitval === 0)) {
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

// atlas()

exports.atlas = () => atlas()
