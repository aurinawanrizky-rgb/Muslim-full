// script.js

const CLIENT_ID = '544009583277-qd8po0m30sat4rnu83oitajs28n0g57h.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient;
let accessToken = null;

const loginButton = document.getElementById('loginGoogle');
const loginStatus = document.getElementById('loginStatus');
const logSection = document.querySelector('.log-section');
const entriesSection = document.querySelector('.entries-section');
const logForm = document.getElementById('logForm');
const reflectionInput = document.getElementById('reflection');
const entriesList = document.getElementById('entriesList');

// -------------------- Google API Init --------------------
function gapiLoaded() {
  gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: '',
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]
  });
}

function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: handleTokenResponse,
  });
}

function handleTokenResponse(resp) {
  if (resp.error) throw resp;
  accessToken = resp.access_token;
  loginStatus.textContent = 'Login berhasil!';
  logSection.style.display = 'block';
  entriesSection.style.display = 'block';
  listNotes();
}

// -------------------- Login Button --------------------
loginButton.addEventListener('click', () => {
  if (!tokenClient) return;
  if (!accessToken) {
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } else {
    tokenClient.requestAccessToken({ prompt: '' });
  }
});

// -------------------- Folder & File Functions --------------------
async function createOrGetFolder() {
  const folderName = 'MuslimFullNotes';
  const res = await gapi.client.drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)'
  });
  if (res.result.files && res.result.files.length > 0) {
    return res.result.files[0].id;
  } else {
    const folder = await gapi.client.drive.files.create({
      resource: {
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id'
    });
    return folder.result.id;
  }
}

async function saveNoteToDrive(text) {
  const folderId = await createOrGetFolder();
  const blob = new Blob([text], { type: 'text/plain' });
  const metadata = {
    name: `note_${new Date().toISOString()}.txt`,
    parents: [folderId]
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + accessToken },
    body: form
  });

  await listNotes();
}

async function listNotes() {
  const folderId = await createOrGetFolder();
  const res = await gapi.client.drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: 'files(id, name, createdTime)'
  });

  entriesList.innerHTML = '';
  if (!res.result.files || res.result.files.length === 0) {
    entriesList.innerHTML = '<li style="color: #555">Belum ada catatan.</li>';
    return;
  }

  res.result.files
    .sort((a,b)=>new Date(b.createdTime)-new Date(a.createdTime))
    .forEach(file=>{
      const li = document.createElement('li');
      li.textContent = `${new Date(file.createdTime).toLocaleString()} - ${file.name}`;
      entriesList.appendChild(li);
    });
}

// -------------------- Form Submit --------------------
logForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const text = reflectionInput.value.trim();
  if (text === '') return;
  await saveNoteToDrive(text);
  reflectionInput.value = '';
});

// -------------------- Init --------------------
window.onload = () => {
  gapiLoaded();
  if (window.google && google.accounts) {
    gisLoaded();
  } else {
    console.log('Google Identity Services belum siap');
  }
};