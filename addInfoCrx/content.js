chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'crawl') {
    console.log('开始爬取流程...');
    
    // 创建一个端口连接
    const port = chrome.runtime.connect({name: "crawlProgress"});

    const scrollAndCollectData = async () => {
      try {
        // 检查是否为成交页面
        if (!window.location.href.includes('.ke.com/chengjiao/c')) {
          console.error('页面URL不符合要求');
          throw new Error('当前页面不是链家成交记录页面');
        }

        // 获取小区ID
        const communityId = window.location.href.match(/\/c(\d+)/)?.[1] || '';
        console.log('小区ID:', communityId);

        // 滚动加载函数
        const scrollToBottom = async () => {
          return new Promise((resolve) => {
            let currentPosition = 0;
            const maxPosition = document.documentElement.scrollHeight;
            const scrollStep = window.innerHeight / 2; // 每次滚动半个屏幕高度
            const scrollDelay = 500; // 滚动间隔时间

            console.log('开始页面滚动加载...');
            console.log('页面总高度:', maxPosition);

            const scroll = async () => {
              if (currentPosition >= maxPosition) {
                window.scrollTo(0, 0); // 滚回顶部
                console.log('滚动加载完成');
                // 等待最后的图片加载
                await new Promise(resolve => setTimeout(resolve, 1000));
                resolve();
                return;
              }

              currentPosition = Math.min(currentPosition + scrollStep, maxPosition);
              window.scrollTo(0, currentPosition);
              console.log(`滚动到位置: ${currentPosition}/${maxPosition}`);

              // 等待图片加载
              await new Promise(resolve => setTimeout(resolve, scrollDelay));

              // 检查当前可见区域内的图片是否已加载
              const visibleImages = document.querySelectorAll('img[data-original]');
              console.log(`检测到 ${visibleImages.length} 张待加载的图片`);

              visibleImages.forEach(img => {
                if (img.src.includes('default_block.png')) {
                  const original = img.getAttribute('data-original');
                  if (original) {
                    console.log('加载图片:', original);
                    img.src = original;
                  }
                }
              });

              scroll();
            };

            scroll();
          });
        };

        // 执行滚动加载
        await scrollToBottom();

        console.log('开始查找成交记录...');
        // 获取所有成交记录列表项
        const deals = document.querySelectorAll('#beike > div.dealListPage > div.content > div.leftContent > div:nth-child(4) > ul > li');
        console.log('找到成交记录数量:', deals.length);

        if (!deals || deals.length === 0) {
          throw new Error('页面上未找到成交记录');
        }

        // 发送总数信息
        port.postMessage({
          success: true,
          type: 'progress',
          progress: {
            type: 'total',
            total: deals.length
          }
        });

        const pageData = [];

        for (const [index, deal] of deals.entries()) {
          try {
            // 发送进度信息
            port.postMessage({
              success: true,
              type: 'progress',
              progress: {
                type: 'progress',
                current: index + 1,
                total: deals.length,
                message: `正在处理第 ${index + 1}/${deals.length} 个房源...`
              }
            });

            console.log(`开始处理第 ${index + 1} 条记录...`);
            
            // 基本信息
            const titleElement = deal.querySelector('div > div.title > a');
            if (!titleElement) {
              console.error(`第 ${index + 1} 条记录未找到标题元素`);
              continue;
            }

            const titleText = titleElement.textContent.trim();
            console.log(`标题文本: ${titleText}`);
            const titleParts = titleText.split(' ');

            // 房屋信息处理
            const houseInfo = deal.querySelector('div > div.address > div.houseInfo')?.textContent.trim() || '';
            console.log(`原始房屋信息: ${houseInfo}`);
            const [direction, decoration] = houseInfo.split('|').map(item => item.trim());
            console.log(`朝向: ${direction}, 装修: ${decoration}`);
            
            // 价格信息处理
            const totalPrice = deal.querySelector('div > div.address > div.totalPrice > span')?.textContent.trim() || '';
            const unitPriceText = deal.querySelector('div > div.flood > div.unitPrice')?.textContent.trim() || '';
            const unitPrice = unitPriceText.replace(/[元\/平]/g, '').trim();
            const listPriceText = deal.querySelector('div > div.dealCycleeInfo > span.dealCycleTxt > span:nth-child(1)')?.textContent.trim() || '';
            // 修改挂牌价提取逻辑，支持小数点
            const listPrice = listPriceText.match(/挂牌([\d.]+)万/)?.[1] || '';
            console.log(`价格信息 - 总价: ${totalPrice}, 单价: ${unitPrice}, 挂牌价: ${listPrice}, 原始挂牌价文本: ${listPriceText}`);
            
            // 楼层信息处理
            const positionInfoText = deal.querySelector('div > div.flood > div.positionInfo')?.textContent.trim() || '';
            console.log(`原始楼层信息: ${positionInfoText}`);
            
            // 拆分楼层信息
            const floorMatch = positionInfoText.match(/(.*)\(共(\d+)层\)/);
            const yearMatch = positionInfoText.match(/(\d{4})年/);
            const buildingTypeMatch = positionInfoText.match(/([板塔]楼)/);
            
            const floor = {
                position: floorMatch ? floorMatch[1].trim() : '', // 楼层位置
                totalFloors: floorMatch ? floorMatch[2] : '',     // 总层数
                year: yearMatch ? yearMatch[1] : '',              // 建筑年代
                buildingType: buildingTypeMatch ? buildingTypeMatch[1] : '' // 楼栋结构
            };
            
            console.log('解析后的楼层信息:', floor);
            
            // 标签和位置信息处理
            const dealHouseTxt = deal.querySelectorAll('div > div.dealHouseInfo > span.dealHouseTxt > span');
            let tag = '';
            let location = '';

            // 遍历所有span元素进行验证
            dealHouseTxt.forEach(span => {
                const text = span?.textContent.trim() || '';
                console.log('处理标签/位置文本:', text);

                // 验证是否为位置信息（包含"距"和"米"）
                if (text.includes('距') && text.includes('米')) {
                    location = text;
                }
                // 验证是否为标签信息（以"房屋"开头）
                else if (text.startsWith('房屋')) {
                    tag = text;
                }
            });

            console.log(`验证后的标签: ${tag}, 位置: ${location}`);
            
            // 交易信息处理
            const dealDate = deal.querySelector('div > div.address > div.dealDate')?.textContent.trim() || '';
            const dealCycle = deal.querySelector('div > div.dealCycleeInfo > span.dealCycleTxt > span:nth-child(2)')?.textContent.trim() || '';
            console.log(`交易信息 - 成交时间: ${dealDate}, 成交周期: ${dealCycle}`);
            
            // 其他信息
            const houseLink = titleElement.href || '';
            // 提取房源ID
            const houseId = houseLink.match(/\/(\d+)\.html/)?.[1] || '';
            console.log(`房源ID: ${houseId}`);
            
            const houseImage = deal.querySelector('a > img')?.src || '';
            console.log(`其他信息 - 链接: ${houseLink}, 图片: ${houseImage}`);

            // 检查户型图是否为默认图片
            if (houseImage.includes('default_block.png')) {
              console.warn(`第 ${index + 1} 条记录的户型图未完全加载`);
            }

            // 获取城市信息
            const cityElement = document.querySelector('#beike > div.dealListPage > div.content > div.leftContent > div.contentBottom.clear > div.crumbs.fl > a:nth-child(1)');
            const city = cityElement ? cityElement.textContent.trim().replace('房产', '') : '';
            console.log(`城市信息: ${city}`);

            const record = {
              '小区ID': communityId,
              '房源ID': houseId,
              '小区名': titleParts[0] || '',
              '户型': titleParts[1] || '',
              '面积': (titleParts[2] || '').replace('平米', ''),
              '朝向': direction || '',
              '装修': decoration || '',
              '楼层': floor.position,
              '总层数': floor.totalFloors,
              '建筑年代': floor.year,
              '楼栋结构': floor.buildingType,
              '标签': tag,
              '位置': location,
              '总价': totalPrice,
              '单价': unitPrice,
              '挂牌价': listPrice,
              '成交时间': dealDate,
              '成交周期': dealCycle.replace(/[成交周期天]/g, ''),
              '房源链接': houseLink,
              '户型图': houseImage,
              '城市': city,
              '数据创建时间': new Date().toLocaleString('zh-CN')
            };
            
            console.log(`第 ${index + 1} 条记录:`, record);
            pageData.push(record);
            console.log(`第 ${index + 1} 条记录处理完成:`, record);
          } catch (err) {
            console.error(`处理第 ${index + 1} 条记录时出错:`, err);
            port.postMessage({
              success: true,
              type: 'progress',
              progress: {
                type: 'error',
                message: `处理第 ${index + 1} 个房源时出错: ${err.message}`
              }
            });
          }
        }

        if (pageData.length === 0) {
          throw new Error('未能成功提取任何记录数据');
        }

        console.log('所有记录处理完成，总数:', pageData.length);
        
        // 发送完成信息
        port.postMessage({
          success: true,
          type: 'progress',
          progress: {
            type: 'complete',
            total: pageData.length
          }
        });

        // 关闭端口连接
        port.disconnect();

        // 返回数据
        return pageData;

      } catch (error) {
        console.error('爬取过程发生错误:', error);
        port.postMessage({
          success: false,
          error: error.message
        });
        port.disconnect();
        throw error;
      }
    };

    // 执行爬取流程并发送响应
    scrollAndCollectData()
      .then(data => {
        console.log('爬取流程成功完成，准备发送数据...');
        sendResponse({
          success: true,
          type: 'data',
          data: data
        });
      })
      .catch(error => {
        console.error('爬取流程失败:', error.message);
        sendResponse({
          success: false,
          error: error.message
        });
      });

    // 告诉Chrome我们会异步发送响应
    return true;
  }

  // 添加在售房源爬取功能
  if (request.action === 'crawlOnSale') {
    console.log('开始爬取在售房源...');
    console.log('当前页面URL:', window.location.href);

    // 创建一个端口连接
    const port = chrome.runtime.connect({name: "crawlProgress"});

    const crawlOnSaleData = async () => {
      try {
        // 检查是否为在售房源列表页面
        if (!window.location.href.includes('.ke.com/ershoufang/c')) {
          throw new Error('当前页面不是链家在售房源列表页面');
        }

        // 获取所有房源链接
        const houseLinks = document.querySelectorAll('#beike > div.sellListPage > div.content > div.leftContent > div:nth-child(4) > ul > li > div > div.title > a');
        console.log('找到房源链接数量:', houseLinks.length);

        // 发送总数信息
        port.postMessage({
          success: true,
          type: 'progress',
          progress: {
            type: 'total',
            total: houseLinks.length
          }
        });

        const pageData = [];
        
        // 遍历每个房源链接
        for (const [index, link] of Array.from(houseLinks).entries()) {
          try {
            // 发送进度信息
            port.postMessage({
              success: true,
              type: 'progress',
              progress: {
                type: 'progress',
                current: index + 1,
                total: houseLinks.length,
                message: `正在处理第 ${index + 1}/${houseLinks.length} 个房源...`
              }
            });

            console.log(`开始处理第 ${index + 1}/${houseLinks.length} 个房源...`);
            
            // 打开新窗口获取详情
            const response = await fetch(link.href);
            const html = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const getTextContent = (selector, removeText = '') => {
              const element = doc.querySelector(selector);
              if (!element) return '';
              let text = element.textContent.trim();
              if (removeText) text = text.replace(removeText, '');
              return text;
            };

            // 提取房源信息
            const record = {
              '小区名': getTextContent('#beike > div.sellDetailPage > div:nth-child(6) > div.overview > div.content > div.aroundInfo > div.communityName > a.info.no_resblock_a'),
              '区域': getTextContent('#beike > div.sellDetailPage > div:nth-child(6) > div.overview > div.content > div.aroundInfo > div.areaName > span.info > a:nth-child(1)'),
              '商圈': getTextContent('#beike > div.sellDetailPage > div:nth-child(6) > div.overview > div.content > div.aroundInfo > div.areaName > span.info > a:nth-child(2)'),
              '户型': getTextContent('#beike > div.sellDetailPage > div:nth-child(6) > div.overview > div.content > div.houseInfo > div.room > div.mainInfo'),
              '面积': getTextContent('#beike > div.sellDetailPage > div:nth-child(6) > div.overview > div.content > div.houseInfo > div.area > div.mainInfo')
                     .replace(/[建筑面积㎡平米]/g, '').trim(),
              '楼层': getTextContent('#beike > div.sellDetailPage > div:nth-child(6) > div.overview > div.content > div.houseInfo > div.room > div.subInfo'),
              '朝向': getTextContent('#beike > div.sellDetailPage > div:nth-child(6) > div.overview > div.content > div.houseInfo > div.type > div.mainInfo'),
              '梯户比': getTextContent('#introduction > div > div > div.base > div.content > ul > li:nth-child(11)', '梯户比例'),
              '总价': getTextContent('#beike > div.sellDetailPage > div:nth-child(6) > div.overview > div.content > div.price-container > div > span.total'),
              '单价': getTextContent('#beike > div.sellDetailPage > div:nth-child(6) > div.overview > div.content > div.price-container > div > div.text > div.unitPrice > span'),
              '挂牌时间': getTextContent('#introduction > div > div > div.transaction > div.content > ul > li:nth-child(1)', '挂牌时间'),
              '上次交易': getTextContent('#introduction > div > div > div.transaction > div.content > ul > li:nth-child(3)', '上次交易'),
              '抵押信息': getTextContent('#introduction > div > div > div.transaction > div.content > ul > li:nth-child(7) > span:nth-child(2)'),
              '户型图': doc.querySelector('#layout > div.layout > div.content > div.imgdiv > img')?.src || '',
              '贝壳编号': getTextContent('#beike > div.sellDetailPage > div:nth-child(6) > div.overview > div.content > div.aroundInfo > div.houseRecord > span.info').replace(/[^\d]/g, ''),
              '房源链接': link.href,
              '城市': getTextContent('#beike > div.sellDetailPage > div:nth-child(4) > div.intro.clear > div > div > a:nth-child(1)').replace('房产', ''),
              '数据创建时间': new Date().toLocaleString('zh-CN')
            };

            // 处理建筑年代和楼栋结构
            const buildingInfo = getTextContent('#beike > div.sellDetailPage > div:nth-child(6) > div.overview > div.content > div.houseInfo > div.area > div.subInfo.noHidden');
            if (buildingInfo) {
              const yearMatch = buildingInfo.match(/(\d{4})年建/);
              const typeMatch = buildingInfo.match(/[板塔]楼/);
              
              record['建筑年代'] = yearMatch ? yearMatch[1] : '';
              record['楼栋结构'] = typeMatch ? typeMatch[0] : '';
              
              console.log(`解析建筑信息: ${buildingInfo} -> 年代: ${record['建筑年代']}, 结构: ${record['楼栋结构']}`);
            }

            // 获取小区ID
            const communityId = window.location.href.match(/\/c(\d+)/)?.[1] || '';
            record['小区ID'] = communityId;

            // 获取房源ID
            const houseId = link.href.match(/\/(\d+)\.html/)?.[1] || '';
            record['房源ID'] = houseId;

            console.log(`第 ${index + 1} 条记录:`, record);
            pageData.push(record);

            // 随机等待1-3秒
            const waitTime = Math.floor(Math.random() * 2000) + 1000;
            await new Promise(resolve => setTimeout(resolve, waitTime));

          } catch (err) {
            console.error(`处理第 ${index + 1} 个房源时出错:`, err);
            port.postMessage({
              success: true,
              type: 'progress',
              progress: {
                type: 'error',
                message: `处理第 ${index + 1} 个房源时出错: ${err.message}`
              }
            });
          }
        }

        if (pageData.length === 0) {
          throw new Error('未能成功提取任何记录数据');
        }

        console.log('所有记录处理完成，总数:', pageData.length);
        
        // 发送完成信息
        port.postMessage({
          success: true,
          type: 'progress',
          progress: {
            type: 'complete',
            total: pageData.length
          }
        });

        // 发送最终数据
        sendResponse({
          success: true,
          type: 'data',
          data: pageData
        });

        // 关闭端口连接
        port.disconnect();

        return pageData;

      } catch (error) {
        port.postMessage({
          success: false,
          error: error.message
        });
        port.disconnect();
        throw error;
      }
    };

    // 执行爬取流程
    crawlOnSaleData().catch(error => {
      console.error('爬取流程失败:', error.message);
    });

    return true; // 保持消息通道开启
  }
}); 