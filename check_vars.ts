async function checkVars() {
  try {
    const response = await fetch("http://localhost:3000/api/debug-vars");
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error(e);
  }
}
checkVars();
