


function decode_address(r)
{
    const xrpl_alphabet = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz'
    try
    {
        if (typeof(r) != 'string')
            return false

        let v = 0n
        let p = 1n
        for (let i = 0; i < r.length-1; ++i)
            p *= 58n;
        for (let i = 0; i < r.length; ++i)
        {
            let c = xrpl_alphabet.indexOf(r[i])
            if (c == -1)
                return false
            v += BigInt(c) * p
            p /= 58n
        }
        return v.toString(16).toUpperCase()
    }
    catch(e)
    {
        return false
    }
}

function encode_address(h)
{
    const xrpl_alphabet = 'rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz'
    try
    {
        if (typeof(h) != 'string')
            return false

        if (h.substr(0,2).toLowerCase() != '0x')
            h = '0x' + h

        let r = BigInt(h)
        let v = ''
        while(r > 0n)
        {
            let d = (r % 58n)
            r /= 58n
            v = xrpl_alphabet[d] + v
        }
        return v
    }
    catch(e)
    {
        return false
    }
}

const makeMap = (defs) =>
{
    if (typeof(defs) == 'undefined' || typeof(defs) != 'object' ||
        typeof(defs.FIELDS) == 'undefined' || 
        typeof(defs.TYPES) == 'undefined' ||
        typeof(defs.TRANSACTION_TYPES) == 'undefined')
            return false;

    let map = {};
    for (let x in defs.FIELDS)
        map[defs.FIELDS[x][0]] = defs.FIELDS[x][1]; 

    return {map: map, types: defs.TYPES, tt: defs.TRANSACTION_TYPES};
};

const encode = (json, defs) =>
{
    if (typeof(json) == 'string')
        json = JSON.parse(json);

    const ret = makeMap(defs);
    if (ret === false)
    {
        console.error("Could not parse definitions");
        return false;
    }

    const map = ret.map;
    const types = ret.types;
    const tts = ret.tt;

    let hex = '';

    for (let key in json)
    {
        if (typeof(map[key]) == "undefined")
        {
            console.error("Could not parse unknown field `" + key + "`. Do you have the correct defs?");
            return false;
        }

        const e = map[key];

        const f = e.nth;
        const t = types[e.type];

        if (typeof(t) == 'undefined')
        {
            console.error("Unknown type `" + e.type + "`. Inconsistent definitions?");
            return false;
        }


        if (t < 16 && f < 16)
            hex += t.toString(16).toUpperCase() + f.toString(16).toUpperCase();
        else if (t >= 16 && f < 16)
        {
            const th = t.toString(16).toUpperCase();
            hex += '0' + f.toString(16).toUpperCase() + (th.length == 1 ? '0' : '') + th;
        }
        else if (t < 16 && f >= 16)
        {
            const fh = f.toString(16).toUpperCase();
            hex += t.toString(16).toUpperCase() + '0' + (fh.length == 1 ? '0' : '') + fh;
        }
        else if (t >= 16 && f >= 16)
        {
            const th = t.toString(16).toUpperCase();
            const fh = f.toString(16).toUpperCase();
            hex += '00' + (th.length == 1 ? '0' : '') + th + (fh.length == 1 ? '0' : '') + fh;
        }

        switch (t)
        {
            case 1:     // uint16
            case 2:     // uint32
            case 16:    // uint8
            {
                const neededlen = ({
                    1: 4,
                    2: 8,
                    16: 2})[t];

                let p = json[key].toString(16).toUpperCase();
                if (key == 'TransactionType')
                {
                    if (typeof(tts[json[key]]) == 'undefined')
                    {
                        console.error("Unknown transaction type: " + json[key]);
                        return false;
                    }
                    p = tts[json[key]].toString(16).toUpperCase();
                }

                if (p.length > neededlen)
                {
                    console.error("UInt (" + key + ") exceeded max value for type. ( > " + neededlen + " nibbles)");
                    return false;
                }
                else if (p.length < neededlen)
                    p = '0'.repeat(neededlen - p.length) + p;

                hex += p;
                break;
            }
            
            case 3:  // uint64
            case 4:  // uint128
            case 5:  // uint256
            case 17: // uint160
            case 20: // uint96
            case 21: // uint192
            case 22: // uint384
            case 23: // uint512
            {
                const neededlen = ({
                    3: 16,
                    4: 32,
                    5: 64,
                    17: 40,
                    20: 24,
                    21: 48,
                    22: 96,
                    23: 128
                })[t];
                
                let p = json[key].toUpperCase().trim();
                if (!p.match('^[A-F0-9]+$'))
                {
                    console.error("Hex expected on key `" + key + "`, but found non-hex characters.");
                    return false;
                }
       
                if (p.length > neededlen)
                {
                    console.error("Hex (" + key + ") exceeded max length for type. ( > " + neededlen + " nibbles)");
                    return false;
                }
                else if (p.length < neededlen)
                    p = '0'.repeat(neededlen - p.length) + p;
                hex += p;
                break;
            }

            case 6: // amount
            {
                if (typeof(json[key]) == 'object')
                {
                    // IOU

                    let amt = 1n << 383n; // non-xrp
                    
                    // float

                    // RH UPTO

                    // currency
                    
                    if (typeof(json[key]['currency']) != 'string')
                    {
                        console.error("Currency in key `" + key + "` was not string.");
                        return false;
                    }


                    let cur = json[key].currency;
                    if (cur.length != 3 && cur.length != 40)
                    {
                        console.error("Currency length was not 3 (ascii) or 40 (hex) on key `" + key "`");
                        return false;
                    }

                    if (cur.length == 3)
                    {
                        //0000000000000000000000004555520000000000

                        let c1 = cur.charCodeAt(0).toString(16);
                        let c2 = cur.charCodeAt(1).toString(16);
                        let c3 = cur.charCodeAt(2).toString(16);

                        cur = '0'.repeat(24) + 
                            (c1.length == 1 ? '0' : '') + c1 +
                            (c2.length == 1 ? '0' : '') + c2 +
                            (c3.length == 1 ? '0' : '') + c3 +
                            '0000000000';
                    }

                    if (!cur.match('^[A-F0-9]+$'))
                    {
                        console.error("Currency was not valid hex key: `" + key "`);
                        return false;
                    }
                    hex += cur;

                    // issuer

                    if (typeof(json[key]['issuer']) != 'string')
                    {
                        console.error("Issuer in key `" + key + "` was not string.");
                        return false;
                    }

                    let issuer = json[key]['issuer'];
                   
                    if (issuer.charCodeAt(0) == 'r'.charCodeAt(0))
                    {
                        // r-address (probably) do a base58 decode
                        issuer = decode_address(issuer);
                        if (issuer === false || issuer.length > 40)
                        {
                            console.error(
                                "Could not parse issuer in key `" + key + "`. Tried to parse r-addr and failed.");
                            return false;
                        }
                    }
                    else if (!issuer.match('^[A-F0-9]{20}$'))
                    {
                        console.error("Could not parse issuer in key `" + key + "`. Tried to parse hex and failed.");
                        return false;
                    }

                    if (issuer.length > 40)
                    {
                        console.error(
                            "Issuer account size wrong on key `" + key "`.");
                        return false;
                    }
                    else
                    if (issuer.length < 40)
                        issuer = '0'.repeat(40 - issuer.length);

                    hex += issuer;
                    break;
                }
                else
                {
                    // native
                    let amt = 0;
                    try
                    {
                        amt = BigInt('' + json[key]);
                    } catch (e) {
                        console.error("Error parsing non-native value on key " + key + ". value: `" + json[key] + "`");
                        return false;
                    }
                    if (amt > 100000000000n || amt < -100000000000n)
                    {
                        console.error(
                            "Error parsing non-native currency, amount is larger than 100B (or less than -100B).");
                        return false;
                    }

                    const pos = amt >= 0;
                    if (!pos)
                        amt *= -1n;

                    if (pos)
                        amt |= (1n << 62n);
                    
                    let p = amt.toString(16).toUpperCase();
                    if (p.length < 16)
                        p = '0'.repeat(16 - p.length) + p;

                    hex += p;
                    break;
                }


                break;
            }

        }
    }

    return hex;

};

const decode = (binhex, defs) =>
{

};

exports.encode = encode;
exports.decode = decode;
