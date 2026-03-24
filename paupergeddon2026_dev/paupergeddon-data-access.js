(function() {
  async function load(name, path) {
    if (window.__PG_DATA && Object.prototype.hasOwnProperty.call(window.__PG_DATA, name)) {
      return window.__PG_DATA[name];
    }

    const resp = await fetch(path);
    if (!resp.ok) {
      throw new Error('Failed to load ' + path + ' (' + resp.status + ')');
    }
    return resp.json();
  }

  window.__pgLoadData = load;
})();
