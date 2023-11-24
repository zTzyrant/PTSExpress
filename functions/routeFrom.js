const isFromTunnel = (origin) => {
  console.log(origin)
  if (origin === "https://q06n1njk-4200.asse.devtunnels.ms") {
    return "https://q06n1njk-3000.asse.devtunnels.ms"
  } else {
    return "http://192.168.18.14:3000"
    // return "https://q06n1njk-3000.asse.devtunnels.ms"
  }
}

module.exports = { isFromTunnel }
