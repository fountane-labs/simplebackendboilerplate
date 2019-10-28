const get = (props, def) => {
    return props.reduce((val, prop) => {
      if (val) {
        return val = val[prop] || def || undefined
      }
      else
        return val = def || undefined
    });
}

module.exports = {
    get
}