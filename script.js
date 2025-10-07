const CLIENT_ID = '544009583277-qd8po0m30sat4rnu83oitajs28n0g57h.apps.googleusercontent.com'; // ganti dengan Client ID Google
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

let tokenClient;
let accessToken = null;

const logForm = document.getElementById('logForm');
const reflectionInput = document.getElementById('reflection');
const entriesList = document.getElementById('entriesList');
const userIcon = document.getElementById('userIcon');

// ---------------- Google API Init ----------------
function gapiLoaded() { gapi.load('client', initializeGapiClient); }
async function initializeGapiClient() {
  await gapi.client.init({
    apiKey: '',
    discoveryDocs: ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"]
  });
}

// ---------------- GIS Init ----------------
function gisLoaded() {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: handleTokenResponse
  });
}

// ---------------- Login callback ----------------
async function handleTokenResponse(resp) {
  if (resp.error) throw resp;
  accessToken = resp.access_token;
  localStorage.setItem('google_access_token', accessToken);
  await fetchUserProfile();
  await listNotes();
}

// ---------------- Fetch profile + fallback ----------------
async function fetchUserProfile() {
  if (!accessToken) return;
  userIcon.innerHTML = '';
  try {
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { 'Authorization': 'Bearer ' + accessToken }
    });
    const profile = await profileRes.json();

    let iconEl;
    if(profile.picture){
      iconEl = document.createElement('img');
      iconEl.src = profile.picture + '?sz=80';
      iconEl.alt = profile.email[0].toUpperCase();
    } else {
      iconEl = document.createElement('div');
      iconEl.textContent = profile.email[0].toUpperCase();
      iconEl.style.background = '#4CAF50';
      iconEl.style.color = 'white';
      iconEl.style.display = 'flex';
      iconEl.style.alignItems = 'center';
      iconEl.style.justifyContent = 'center';
      iconEl.style.fontWeight = 'bold';
      iconEl.style.fontSize = '20px';
    }
    iconEl.style.width = '40px';
    iconEl.style.height = '40px';
    iconEl.style.borderRadius = '50%';
    iconEl.style.cursor = 'pointer';
    userIcon.appendChild(iconEl);

  } catch(err){
    console.log('Gagal ambil foto user:', err);
    userIcon.textContent = '❓';
  }
}

// ---------------- Drive functions ----------------
async function createOrGetFolder() {
  const folderName = 'MuslimFullNotes';
  const res = await gapi.client.drive.files.list({
    q: `name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)'
  });
  if (res.result.files?.length) return res.result.files[0].id;
  const folder = await gapi.client.drive.files.create({
    resource: { name: folderName, mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id'
  });
  return folder.result.id;
}

async function saveNoteToDrive(text) {
  const folderId = await createOrGetFolder();
  const blob = new Blob([text], { type: 'text/plain' });
  const metadata = { name:`note_${new Date().toISOString()}.txt`, parents:[folderId] };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', blob);

  await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
    method:'POST',
    headers:{ 'Authorization': 'Bearer ' + accessToken },
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
  if (!res.result.files?.length){
    entriesList.innerHTML = '<li style="color:#555">Belum ada catatan.</li>';
    return;
  }

  const files = res.result.files.sort((a,b)=>new Date(b.createdTime)-new Date(a.createdTime));
  for(const file of files){
    try{
      const contentRes = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
        headers:{ 'Authorization':'Bearer ' + accessToken }
      });
      const text = await contentRes.text();
      const li = document.createElement('li');
      li.textContent = `${new Date(file.createdTime).toLocaleString()} - ${text}`;
      entriesList.appendChild(li);
    }catch(err){ console.log(err); }
  }
}

// ---------------- Form submit ----------------
logForm.addEventListener('submit', async e=>{
  e.preventDefault();
  const text = reflectionInput.value.trim();
  if (!text) return;
  if(!accessToken) tokenClient.requestAccessToken({prompt:'consent'});