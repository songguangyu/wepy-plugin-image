const path = require('path');
const fs = require('fs');
const mime = require('mime');
// TODO key 没有配置的提示
const packQiniu = require('pack-qiniu');
const validator = require('validator');

class ImageParse {
  constructor(cfg = {}) {
    // TODO filter
    this.config = Object.assign({
      limit: 1024,
      debugMode: false,
    }, cfg);
  }

  apply(op) {
    const { code, file } = op;
    const config = this.config;
    const { debugMode } = config;
    if (debugMode) {
      console.log('wepy-plugin-image file', file);
    }

    const reg = /url\((.*?)\)/gi;
    if (!code) {
      if (debugMode) {
        console.error('code is null');
      }
      op.next();
    } else {
      const bgPaths = code.match(reg) || [];
      if (debugMode) {
        console.log('wepy-plugin-image bgPaths', bgPaths);
      }

      const base64List = [];
      const uploadList = [];
      bgPaths.forEach((item) => {
        const bgImage = item.replace(/'/g, '').replace(/"/g, '').replace('url(', '').replace(/\)$/g, '');
        // TODO 本身是base64, 绝对地址的图片
        if (!validator.isURL(bgImage)) {
          // 图片做忽略，不做拷贝，取的是src的图片
          const bgPath = path.join(path.dirname(file.replace('dist', 'src')), bgImage);
          const stats = fs.statSync(bgPath);
          if (fs.existsSync(bgPath)) {
            if (stats.size > config.limit) {
              uploadList.push({
                path: bgPath,
                bg: bgImage,
              });
            } else {
              base64List.push({
                path: bgPath,
                bg: bgImage,
              });
            }
          } else {
            if (debugMode) {
              console.error('%s不存在', bgPath);
            }
          }
        }
      });
      base64List.forEach((base64file) => {
        const base64Content = fs.readFileSync(base64file.path).toString('base64');
        const mimeType = mime.getType(base64file.path);
        const data = `data:${mimeType};base64,${base64Content}`;
        op.code = op.code.replace(base64file.bg, `${data}`);
      });

      const promiseUploadList = [];
      uploadList.forEach((uploadfile) => {
        promiseUploadList.push(packQiniu(uploadfile.path, uploadfile));
      });
      // 无图片的时候
      if (!promiseUploadList.length) {
        if (debugMode) {
          console.log('wepy-plugin-image no upload image');
        }
        op.next();
        return;
      }
      Promise.all(promiseUploadList).then((resultList) => {
        resultList.forEach((item) => {
          const bgUrl = item.options.bg;
          const uploadUrl = item.url.replace('http://', 'https://');
          op.code = op.code.replace(bgUrl, uploadUrl);
        });
        op.next();
      });
    }

    // var pathFile = _path2.default.join(path.dirname(file.replace('dist', 'src')), imgPath);
    //   { type: 'css',
    // code: '.panel {\n  width: 100%;\n  margin-top: 20rpx;\n  text-align: left;\n  font-size: 12px;\n  padding-top: 20rpx;\n  padding-left: 50rpx;\n  padding-bottom: 20rpx;\n  border: 1px solid #ccc;\n}\n.panel .title {\n  padding-bottom: 20rpx;\n  font-size: 14px;\n  font-weight: bold;\n}\n.panel .info {\n  padding: 15rpx;\n}\n.panel .testcounter {\n  margin-top: 15rpx;\n  position: absolute;\n}\n.panel .counterview {\n  margin-left: 120rpx;\n}\n.panel .image {\n  width: 20px;\n  height: 20px;\n  background-image: url(image/icon-super@2x.png);\n}\n',
    // file: '/Users/huixisheng/Workspaces/dist/components/member-card.wxss',
    // output: [Function: output],
    // done: [Function: done],
    // next: [Function],
    // catch: [Function] }
  }
}

module.exports = ImageParse;