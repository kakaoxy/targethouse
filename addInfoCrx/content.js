chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'crawl') {
    console.log('开始爬取流程...');
    console.log('当前页面URL:', window.location.href);

    // 创建一个Promise来处理滚动加载
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

        const pageData = [];

        for (const [index, deal] of deals.entries()) {
          try {
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
              '数据创建时间': new Date().toLocaleString('zh-CN')
            };
            
            pageData.push(record);
            console.log(`第 ${index + 1} 条记录处理完成:`, record);
          } catch (err) {
            console.error(`处理第 ${index + 1} 条记录时出错:`, err);
            console.error('错误详情:', err.stack);
          }
        }

        if (pageData.length === 0) {
          throw new Error('未能成功提取任何记录数据');
        }

        console.log('所有记录处理完成，总数:', pageData.length);
        return pageData;
      } catch (error) {
        throw error;
      }
    };

    // 执行爬取流程
    scrollAndCollectData()
      .then(data => {
        console.log('爬取流程成功完成，准备发送数据...');
        sendResponse({success: true, data: data});
      })
      .catch(error => {
        console.error('爬取流程失败:', error.message);
        sendResponse({success: false, error: error.message});
      });

    return true; // 保持消息通道开启
  }
}); 