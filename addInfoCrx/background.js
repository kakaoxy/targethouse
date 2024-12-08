chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'exportExcel') {
    const data = request.data;
    
    if (data.length === 0) {
      console.error('没有数据可导出');
      sendResponse({ success: false, error: '没有数据可导出' });
      return true;
    }
    
    try {
      // 获取表头
      const headers = Object.keys(data[0]);
      
      // 创建CSV内容
      let csvContent = '\ufeff'; // 添加BOM标记支持中文
      
      // 添加表头
      csvContent += headers.map(header => `"${header}"`).join(',') + '\n';
      
      // 添加数据行
      data.forEach(record => {
        const row = headers.map(header => {
          const value = record[header] || '';
          // 处理包含逗号、换行符或引号的值
          if (/[,\n"]/.test(value)) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value;
        });
        csvContent += row.join(',') + '\n';
      });

      // 将CSV内容转换为Base64
      const base64Content = btoa(unescape(encodeURIComponent(csvContent)));
      const dataUrl = 'data:text/csv;charset=utf-8;base64,' + base64Content;
      
      // 获取当前时间作为文件名的一部分
      const now = new Date();
      const timestamp = now.toISOString().replace(/[:.]/g, '-');
      
      // 下载文件
      chrome.downloads.download({
        url: dataUrl,
        filename: `链家成交记录_${timestamp}.csv`,
        saveAs: true
      }, (downloadId) => {
        // 检查下载是否成功启动
        if (chrome.runtime.lastError) {
          console.error('下载出错:', chrome.runtime.lastError);
          sendResponse({ 
            success: false, 
            error: chrome.runtime.lastError.message 
          });
        } else {
          console.log('下载已开始，ID:', downloadId);
          sendResponse({ 
            success: true, 
            downloadId: downloadId 
          });
        }
      });
      
      return true; // 保持消息通道开启
    } catch (error) {
      console.error('导出CSV时出错:', error);
      sendResponse({ 
        success: false, 
        error: error.message 
      });
      return true;
    }
  }
  return true;
}); 