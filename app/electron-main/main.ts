import { app, BrowserWindow, ipcMain, screen } from 'electron';
import { EoUpdater } from './updater';
import * as path from 'path';
import * as os from 'os';
import ModuleManager from '../../shared/node/extension-manager/manager';
import { ModuleManagerInterface } from '../../shared/node/extension-manager/types';
import { AppViews } from './appView';
import { CoreViews } from './coreView';
import { processEnv } from '../../platform/node/constant';
import { proxyOpenExternel } from '../../shared/common/browserView'
let win: BrowserWindow = null;
export const subView = {
  appView: null,
  mainView: null,
};
const eoUpdater = new EoUpdater();
const moduleManager: ModuleManagerInterface = ModuleManager();

function createWindow(): BrowserWindow {
  const electronScreen = screen;
  const size = electronScreen.getPrimaryDisplay().workAreaSize;
  // Create the browser window.
  win = new BrowserWindow({
    width: size.width * 0.8,
    height: size.height * 0.8,
    useContentSize: true, // 这个要设置，不然计算显示区域尺寸不准
    frame: os.type() === 'Darwin' ? true : false, //mac use default frame
    webPreferences: {
      nodeIntegration: true,
      allowRunningInsecureContent: processEnv === 'serve' ? true : false,
      contextIsolation: false, // false if you want to run e2e test with Spectron
    },
  });
  if (processEnv === 'serve') {
    require('electron-reload')(__dirname, {
      electron: require(path.join(__dirname, '/../node_modules/electron')),
    });
  }
  proxyOpenExternel(win);
  let loadPage = () => {
    const file: string = `file://${path.join(__dirname, '../browser', 'index.html')}`;
    win.loadURL(file).finally();
    // win.webContents.openDevTools();
  };
  win.webContents.on('did-fail-load', () => {
    loadPage();
  });
  win.webContents.on('did-finish-load', () => {
    //remove origin view
    for (var i in subView) {
      if (!subView[i]) break;
      subView[i].remove();
    }
    subView.mainView = new CoreViews(win).create();
    subView.appView = new AppViews(win).create('default');
    for (var i in subView) {
      if (!subView[i]) break;
      proxyOpenExternel(subView[i]);
    }
  });
  loadPage();

  // Emitted when the window is closed.
  win.on('closed', () => {
    // Dereference the window object, usually you would store window
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    win = null;
  });

  return win;
}

try {
  // This method will be called when Electron has finished
  // initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  // Added 400 ms to fix the black background issue while using transparent window. More detais at https://github.com/electron/electron/issues/15947
  app.on('ready', () => {
    setTimeout(createWindow, 400);
    eoUpdater.check();
  });
  //!TODO only api manage app need this
  // setupUnit(subView.appView);

  // Quit when all windows are closed.
  app.on('window-all-closed', () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  // resize 监听，改变browserview bounds

  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (win === null) {
      createWindow();
    }
  });
  ipcMain.on('message', function (event, arg) {
    console.log('recieve render msg=>', arg, arg.action);
    //only action from mainView can be executed
    if (event.frameId !== 1) return;
    switch (arg.action) {
      case 'minimize': {
        win.minimize();
        break;
      }
      case 'restore': {
        win.restore();
        break;
      }
      case 'maximize': {
        win.maximize();
        break;
      }
      case 'close': {
        win.close();
        break;
      }
    }
  });
  // 这里可以封装成类+方法匹配调用，不用多个if else
  ipcMain.on('eo-sync', (event, arg) => {
    let returnValue: any;
    if (arg.action === 'getApiAccessRules') {
      // 后期加入权限生成，根据moduleID，上层moduleID，应用范围等
      // 或者是像Android, 跳出权限列表让用户自己选择确认放开的权限。
      const output: string[] = ['getModules', 'getAppModuleList', 'getSlideModuleList', 'hook'];
      returnValue = output;
    } else if (arg.action === 'getModules') {
      returnValue = moduleManager.getModules(true);
    } else if (arg.action === 'getAppModuleList') {
      returnValue = moduleManager.getAppModuleList();
    } else if (arg.action === 'getSlideModuleList') {
      returnValue = moduleManager.getSlideModuleList(subView.appView.moduleID);
    } else if (arg.action === 'getSlidePosition') {
      returnValue = subView.appView.slidePosition;
    } else if (arg.action === 'hook') {
      returnValue = 'hook返回';
    } else if (arg.action === 'openApp') {
      if (arg.data.moduleID) {
        // 如果要打开是同一app，忽略
        if (subView.appView.moduleID === arg.data.moduleID) {
          return;
        }
        subView.appView = new AppViews(win).create(arg.data.moduleID);
      }
      returnValue = 'view id';
    } else if (arg.action === 'openModal') {
      console.log('openModal');
      subView.mainView.webContents.send('connect-main', { action: 'openModal' });
    } else {
      returnValue = 'Invalid data';
    }
    event.returnValue = returnValue;
  });
} catch (e) {
  // Catch Error
  // throw e;
}
