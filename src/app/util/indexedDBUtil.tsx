import * as moment from 'moment';
let db: { transaction: (arg0: string[], arg1: string) => { (): any; new(): any; objectStore: { (arg0: string): {
    [x: string]: any; (): any; new(): any; delete: { (arg0: any): any; new(): any; }; 
}; new(): any; }; }; };

const indexedDB =
  window['indexedDB'] ||
  window['mozIndexedDB'] ||
  window['webkitIndexedDB'] ||
  window['msIndexedDB'] ||
  window['shimIndexedDB'];

const constants = {
  SESSION_ENTRIES: '__sessionEntries',
  VHWEB_SESSION: 'vhweb_session',
  CACHE_DATE: 'cacheDate',
};

// on browser refresh
window.addEventListener('beforeunload', async function() {
  await indexedDBUtil.removeItem(constants.VHWEB_SESSION);
});

const checkIndexedDBSupport = async () => {
  if (!indexedDB) {
    console.log(`Your browser doesn't support IndexedDB`);
    return false;
  }
  return true;
};

type resetType = 'on_refresh' | 'per_session' | 'daily';
const resetAPICache = async (resetType: resetType = 'on_refresh') => {
  const {getItem, setItem} = indexedDBUtil;
  if (resetType === 'on_refresh') {
    const vhweb_session = await getItem(constants.VHWEB_SESSION);
    if (vhweb_session) {
      console.log('vhweb_cache exist');
    } else {
      console.log('vhweb_cache created');
      removeCacheEntries();
      await setItem(constants.VHWEB_SESSION, 1);
    }
  } else if (resetType === 'per_session') {
    // no-op
  } else if (resetType === 'daily') {
    // Check if date changed then clear storeType='session' cache
    const currentDate = moment().format('MMDDYY');
    const storedDate = localStorage[constants.CACHE_DATE];
    if (storedDate) {
      if (storedDate !== currentDate) {
        removeCacheEntries();
      }
    }
    localStorage[constants.CACHE_DATE] = currentDate;
    setInterval(() => {
      // clear session cache every 8 hours, only when browser is open
      removeCacheEntries();
    }, 3600000 * 8);
  }
};

async function removeCacheEntries() {
  const removeMapList = await getItem(constants.SESSION_ENTRIES);
  console.log('cache was reset');
  if (removeMapList) {
    // clear session vars to refresh
    Object.keys(removeMapList).forEach(async key => {
      if (key !== constants.SESSION_ENTRIES) {
        await removeItem(key);
      }
    });
    removeItem(constants.SESSION_ENTRIES);
  }
}

const openDatabase = async () => {
  const request = indexedDB.open('VHWEB', 2);

  return new Promise((resolve, reject) => {
    request.onerror = () => {
      reject(`Error opening database ${request.error}`);
    };

    request.onsuccess = (event: any) => {
      db = event.target.result;
      resolve(true);
    };

    request.onupgradeneeded = function(event: any) {
      var db = event?.target.result;
      var transaction = event.target.transaction;
      var objectStore;
      if (!db.objectStoreNames.contains('cache')) {
        // create cache
        objectStore = db.createObjectStore('cache', {keyPath: 'key'});
      } else {
        objectStore = transaction.objectStore('cache'); // update and clear cache
        console.log('clearing objectStore cache on upgrade.');
        objectStore.clear();
        resolve(true);
      }
    };
  });
};

async function getItem(key: string): Promise<any> {
  if (!indexedDB) {
    return Promise.resolve(false);
  }
  let txn:any = null;
  try {
    txn = db.transaction(['cache'], 'readonly');
  } catch (e) {
    await openDatabase();
    txn = db.transaction(['cache'], 'readonly');
  }

  const objectStore = txn.objectStore('cache');
  const request = objectStore.get(key);
  return new Promise((resolve, reject) => {
    request.onerror = function() {
      console.error('error in IndexedDB getItem.');
      resolve(null);
    };
    request.onsuccess = function(event: { target: { result: any; }; }) {
      const result = event.target.result;
      //delete result.key;
      if (result && result.data) {
        resolve(result.data);
      } else {
        resolve(result);
      }
    };
  });
}

async function setItem(
  key: string,
  jsonData: any,
  storeType: 'persist' | 'session' = 'persist',
): Promise<any> {
  if (!indexedDB) return;
  const item = {
    key,
    data: jsonData,
  };
  const txn = db.transaction(['cache'], 'readwrite');
  const objectStore = txn.objectStore('cache');
  const request = objectStore.put(item);

  if (storeType === 'session') {
    // store keys that needs to be cleared from localDB in every new session.
    let removeMap = await getItem(constants.SESSION_ENTRIES);
    removeMap = removeMap ? removeMap : {};
    removeMap[key] = true;
    setItem(constants.SESSION_ENTRIES, removeMap);
  }

  return new Promise((resolve, reject) => {
    request.onsuccess = function(event: any) {
      resolve('true');
    };
    request.onerror = function(event: any) {
      reject(request.error);
    };
  });
}

async function removeItem(key: string): Promise<any> {
  const request = db
    .transaction(['cache'], 'readwrite')
    .objectStore('cache')
    .delete(key);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      resolve('success');
    };

    request.onerror = (err: any) => {
      console.error(`Unable to delete item: ${key}`);
      reject(request.error);
    };
  });
}

const hashCode = (s: string) => {
  if (typeof s === 'object') {
    s = JSON.stringify(s);
  }
  let h;
  for (let i = 0; i < s.length; i++)
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
};

function cloneObject(obj: string | any[]) {
	if (Object.prototype.toString.call(obj) === '[object Array]') {
		return obj.slice();
	}
	return JSON.parse(JSON.stringify(obj));
};

const init = async () => {
  const supported = await checkIndexedDBSupport();
  if (supported) {
    await openDatabase();
    await resetAPICache();
  }
};

init();

export const indexedDBUtil = {
  constants,
  checkIndexedDBSupport,
  openDatabase,
  setItem,
  getItem,
  removeItem,
  hashCode,
  cloneObject,
};

export interface IKeyData {
  key: string;
  data: any;
}