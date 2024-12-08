let crawledData = null;

function showPreview(data) {
  const previewArea = document.getElementById('previewArea');
  const table = document.getElementById('previewTable');
  const thead = table.querySelector('thead tr');
  const tbody = table.querySelector('tbody');
  const buttons = document.querySelector('.buttons');
  
  // 清空现有内容
  thead.innerHTML = '';
  tbody.innerHTML = '';
  
  // 显示预览区域和按钮
  previewArea.style.display = 'block';
  buttons.style.display = 'block';
  
  // 添加表头
  const headers = Object.keys(data[0]);
  headers.forEach(header => {
    const th = document.createElement('th');
    th.textContent = header;
    thead.appendChild(th);
  });
  
  // 添加前5条数据
  const previewData = data.slice(0, 5);
  previewData.forEach(record => {
    const tr = document.createElement('tr');
    headers.forEach(header => {
      const td = document.createElement('td');
      td.textContent = record[header] || '';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

document.getElementById('crawlBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('status');
  const btn = document.getElementById('crawlBtn');
  
  try {
    // 禁用按钮
    btn.disabled = true;
    statusDiv.textContent = '正在爬取数据，请稍候...';
    
    // 获取当前标签页
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    if (!tab.url.includes('.ke.com/chengjiao/c')) {
      throw new Error('请在链家成交记录页面使用此功能');
    }
    
    // 向content script发送消息开始爬取
    const response = await chrome.tabs.sendMessage(tab.id, {action: 'crawl'});
    
    if (response.success) {
      if (response.data.length === 0) {
        statusDiv.textContent = '未找到成交记录数据';
        return;
      }
      
      statusDiv.textContent = `已找到 ${response.data.length} 条记录，请确认数据是否正确：`;
      crawledData = response.data;
      showPreview(response.data);
    } else {
      throw new Error(response.error || '爬取失败');
    }
  } catch (error) {
    statusDiv.textContent = '错误：' + error.message;
    console.error('操作错误:', error);
  } finally {
    // 重新启用按钮
    btn.disabled = false;
  }
});

// 确认按钮事件
document.getElementById('confirmBtn').addEventListener('click', () => {
  if (!crawledData) return;
  
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = '正在保存数据...';
  
  // 发送数据到background script处理导出
  chrome.runtime.sendMessage({
    action: 'exportExcel',
    data: crawledData
  }, (result) => {
    if (chrome.runtime.lastError) {
      statusDiv.textContent = '导出失败：' + chrome.runtime.lastError.message;
      console.error('导出错误:', chrome.runtime.lastError);
      return;
    }
    
    if (result && result.success) {
      statusDiv.textContent = '爬取完成！请在下载栏查看CSV文件。';
      console.log('下载ID:', result.downloadId);
      
      // 隐藏预览和按钮
      document.getElementById('previewArea').style.display = 'none';
      document.querySelector('.buttons').style.display = 'none';
    } else {
      statusDiv.textContent = '导出失败：' + (result?.error || '未知错误');
      console.error('导出失败:', result?.error);
    }
  });
});

// 取消按钮事件
document.getElementById('cancelBtn').addEventListener('click', () => {
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = '已取消导出';
  
  // 隐藏预览和按钮
  document.getElementById('previewArea').style.display = 'none';
  document.querySelector('.buttons').style.display = 'none';
  crawledData = null;
}); 