const gp = require('../helpers/props').get;

const getDataType = (field) => {
    let dataType = 'string';
    switch(field){
        case 'match_date': dataType = 'date'; break;
        case 'type': dataType = 'string'; break;
        case 'id': dataType = 'number'; break;
        case 'cricapi_id': dataType = 'number'; break;
        case 'pid': dataType = 'number'; break;
        case 'team_id': dataType = 'number'; break;
        case 'league_id': dataType = 'number'; break;
        case 'match_id': dataType = 'number'; break;
        case 'team_one': dataType = 'number'; break;
        case 'team_two': dataType = 'number'; break;
        case 'campaign_id': dataType = 'number'; break;
        case 'matchstarted': dataType = 'boolean'; break;
        case 'email': dataType = 'boolean'; break;
        case 'login_id': dataType = 'number'; break;
        case 'points': dataType = 'number'; break;
        case 'account_number': dataType = 'number'; break;
        case 'ifsc': dataType = 'number'; break;
        case 'bank_name': dataTYpe = 'number'; break;
        case 'total_scoring': dataType = 'number'; break;
        case 'status': dataType = 'number'; break;
        case 'amount_to_join': dataType = 'number'; break;
        case 'winning_price': dataType = 'number'; break;
        case 'winners': dataType = 'number'; break;
        case 'spots': dataType = 'number'; break;
        case 'participants': dataType = 'number'; break;
        case 'tax': dataType = 'number'; break;
        case 'bonus': dataType = 'number'; break;
        case 'transaction_time': dataType = 'date'; break;
        case 'deposit': dataType = 'number'; break;
        case 'get_bonus': dataType = 'number'; break;
    }
    return dataType;
}

const getSearchQueryJson = (field, val, options) => {
    let dataType = 'string';
    if(!field || !val){
        dataType = '';
    }

    dataType = getDataType(field);

    // let fieldPrefix = gp([options, 'fieldPrefix'],' ');
    // let globalPrefix = gp([options, 'globalPrefix'], ' ');

    switch(dataType){
        case 'string': return {
            [field]: {
                $like: `%${val}%`
            }
        }; break;
        case 'number': return {
            [field]: val
        }; break;
        case 'date': return {
            [field]: val
        }; break;
        default:  return undefined;
        // case 'string': return `${globalPrefix} ${fieldPrefix}${field} LIKE '%${val}%'`; break;
        // case 'date': return `${globalPrefix} ${fieldPrefix}${field} = '${val}'`; break;
        // case 'number': return `${globalPrefix} CAST(${fieldPrefix}${field} as varchar) LIKE '%${val}%'`; break;
        // case 'boolean': return `${globalPrefix} ${fieldPrefix}${field} = ${val || false}`; break;
        // default: return '';
    };
}

const getSearchQuery = (field, val, options) => {
    let dataType = 'string';
    if(!field || !val){
        dataType = '';
    }

    dataType = getDataType(field);

    let fieldPrefix = gp([options, 'fieldPrefix'],' ');
    let globalPrefix = gp([options, 'globalPrefix'], ' ');

    switch(dataType){
        case 'string': return `${globalPrefix} ${fieldPrefix}${field} LIKE '%${val}%'`; break;
        case 'date': return `${globalPrefix} ${fieldPrefix}${field} = '${val}'`; break;
        case 'number': return `${globalPrefix} CAST(${fieldPrefix}${field} as varchar) LIKE '%${val}%'`; break;
        case 'boolean': return `${globalPrefix} ${fieldPrefix}${field} = ${val || false}`; break;
        default: return '';
    };

};

const getSortQuery = (field, val, options) => {
    let dataType = 'string';
    if(!field || !val){
        dataType = '';
    }
        
    let fieldPrefix = gp([options, 'fieldPrefix'], ' ');
    let globalPrefix = gp([options, 'globalPrefix'], ' ');

    dataType = getDataType(field);

    switch(dataType){
        case 'string': return `${globalPrefix} ORDER BY ${fieldPrefix}${field} ${val}`; break;
        case 'number': return `${globalPrefix} ORDER BY ${fieldPrefix}${field} ${val}`; break;
        default: return ``;
    }
}


module.exports = {
    getSearchQuery,
    getSortQuery,
    getSearchQueryJson
}