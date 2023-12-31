const jsdom = require('jsdom')
const fs = require('fs');
const stockId = 1234356

const writeTimeToFile = (time) => {
    fs.appendFile('log.txt', `${time}\n`, (err) => {
        if (err) {
            console.error('Ошибка при записи в файл:', err);
        } else {
            console.log('Время записано в файл');
        }
    });
};

const token = 'y0_AgAAAAAoa-JjAArjlQAAAADzHFujshZ6EM50R9an1lpnrPbp0f2hCkI'

const baseTgUrl = 'https://t.me/BigSaleApple/'
const messages = ['11198', '11199', '11200']

const badMarks = [ 'гарантия', 'притертости', 'приертости', 'брак'];
const goodMarks = ['🇮🇳','🇰🇼', '🇯🇵', '🇨🇦', '🇮🇳', '🇸🇬', '🇪🇺']

const tomatoEmoji = '🍎'

const itemsMap = {
    '14 128 Purple': 'iphone14purple128',
    '14 128 Starlight': 'iphone14starlight128',
    '14 128 Midnight': 'iphone14midnight',
    '14 128 Black': 'iphone14midnight',
    '14 128 Blue': 'iphone14blue128nanoesim',
    '13 128 Midnight': 'iphone13midnight128',
    '13 128 Green': 'iphone13green128',
    '13 128 Blue': 'iphone13blue128dualsimesim',
    '13 128 Starlight': 'iphone13starlight128dualsimesim',
    '13 128 Pink': 'iphone13pink128dualsimesim',
    '15 Pro 128 Black': '15_Pro_128_Black',
    '15 Pro 128 Blue': 'iphone15problue128dualsimesim',
    '15 Pro 128 White': 'iphone15problack128dualnanoesim',
    '15 Pro 128 Natural': 'iphone15probatural128titansimesim',
    '15 Pro Max 256 Natural': 'iphone15promaxnatural256',
    '15 Pro Max 256 White': 'iphone15promaxwhite256',
    '15 Pro Max 256 Blue': 'iphone15promaxblue256',
    '15 Pro Max 256 Black': 'iphone15promaxblack256'
}

const overPercent = 7
const categoryFee = 9
const getMoneyFormMarketFee = 2.4
const logistics = 440
const individualEntrepreneurTax = 6
const marketingPercent = 0

const getNewPrice = (startPrice) => {
    return Math.ceil(((startPrice + logistics + 100) / (100 - categoryFee - getMoneyFormMarketFee - individualEntrepreneurTax - marketingPercent) * 100) * ((overPercent / 100) + 1))
}
const updatePrices = async (prices) => {
    try {
        const res = await fetch('https://api.partner.market.yandex.ru/businesses/96892599/offer-prices/updates', {
            method: 'post',
            headers: new Headers({
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify(prices)
        })
    } catch (err) {
        console.log(err)
    }
}

const updateLeftovers = async (leftovers) => {
    try {
        const res = await fetch('https://api.partner.market.yandex.ru/campaigns/78538934/offers/stocks', {
            method: 'put',
            headers: new Headers({
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify(leftovers)
        })
    } catch (err) {
        console.log(err)
    }
}

const getMessage = async (messageId) => {
    try {
        const res =   await fetch(`${baseTgUrl}${messageId}`)
        const html = await res.text()
        const dom = new jsdom.JSDOM(html);
        const content = dom.window.document.querySelector("meta[property='og:description']").content
        return content
    } catch {
        console.log('Ошибка при получении информации из Telegram канала')
    }
}

const matchItems = (message) => {
    let curr =  message.split('\n')
    if (curr.indexOf(tomatoEmoji) !== -1) {
        curr.splice(curr.indexOf(tomatoEmoji), curr.length)
    }
    curr.map((item, itemIdx) => {
        let ok = false
        goodMarks.forEach(goodMark => {
            if (item.indexOf(goodMark) !== -1) {
                ok = true
            }
        })
        if (!ok) {
            curr[itemIdx] = ''
        }
    })
    badMarks.forEach((badMark, idx) => {
        curr.map((item, itemIdx) => {
            if (item.indexOf(badMark) !== -1) {
                curr[itemIdx] = ''
            }
        }
        )
    })
    curr = curr.filter(Boolean).filter(item => item.indexOf('-') !== -1).map(item => {
        let splited = item.split('-')
        if (splited[1]) {
            return [splited[0].trim(), +splited[1].replace(/[^0-9]/g,"")]
        }
    })

    return curr
}

const changeMarketPrices = async () => {
    try {
        const date = new Date()
        const res = await Promise.all([getMessage(messages[0]), getMessage(messages[1]), getMessage(messages[2])])
        const matched = res.map(modelPricesMessage => matchItems(modelPricesMessage)).flat()
        const matchedNewPrice = matched.map(item => [item[0], getNewPrice(item[1])])

        const offers = []
        const leftovers = []
        const positiveLeftovers = []

        matchedNewPrice.forEach(newPriceElement => {
            const [name, price] = newPriceElement
            if (itemsMap[name]) {
                leftovers.push({sku: itemsMap[name], warehouseId: stockId, items: [{count: 3, type: "FIT", updatedAt: date.toISOString()}]})
                positiveLeftovers.push(itemsMap[name])
                offers.push({
                    offerId: itemsMap[name],
                    price: {value: price, currencyId: 'RUR', discountBase: Math.ceil(price * 1.15)}
                })
            }
        })

        const negativeLeftovers = Object.values(itemsMap).filter(el => !positiveLeftovers.includes(el))

        negativeLeftovers.forEach(negativeSku => {
            leftovers.push({sku: negativeSku, warehouseId: stockId, items: [{count: 0, type: "FIT", updatedAt: date.toISOString()}]})
        })

        await updateLeftovers({skus: leftovers})
        await updatePrices({offers: offers})

        const currentTime = new Date().toLocaleString();
        writeTimeToFile(currentTime);
    } catch {
        console.log('Не удалось поменять цены, произошла ошибка')
    }
}

changeMarketPrices()

setInterval(changeMarketPrices, 1800000)
