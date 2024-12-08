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
document.getElementById('confirmBtn').addEventListener('click', async () => {
  if (!crawledData) return;
  
  const statusDiv = document.getElementById('status');
  statusDiv.textContent = '正在处理数据...';
  
  try {
    // 1. 保存为CSV文件
    chrome.runtime.sendMessage({
      action: 'exportExcel',
      data: crawledData
    }, async (result) => {
      if (chrome.runtime.lastError) {
        statusDiv.textContent = '导出CSV失败：' + chrome.runtime.lastError.message;
        console.error('导出错误:', chrome.runtime.lastError);
        return;
      }
      
      if (!result || !result.success) {
        statusDiv.textContent = '导出CSV失败：' + (result?.error || '未知错误');
        console.error('导出失败:', result?.error);
        return;
      }
      
      // 2. 调用后端API保存数据
      try {
        statusDiv.textContent = '正在保存到数据库...';
        
        const response = await fetch('http://localhost:8000/api/houses/sold', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(crawledData)
        });
        
        const apiResult = await response.json();
        
        if (!response.ok) {
          throw new Error(apiResult.detail || '保存到数据库失败');
        }
        
        console.log('API响应:', apiResult);
        
        // 3. 显示完成信息
        statusDiv.textContent = `处理完成！
          CSV文件已保存（下载ID: ${result.downloadId}）
          数据库新增: ${apiResult.inserted_count} 条记录`;
        
        // 隐藏预览和按钮
        document.getElementById('previewArea').style.display = 'none';
        document.querySelector('.buttons').style.display = 'none';
        
      } catch (error) {
        console.error('API调用错误:', error);
        statusDiv.textContent = `CSV已保存，但数据库保存失败: ${error.message}`;
      }
    });
  } catch (error) {
    statusDiv.textContent = '处理失败：' + error.message;
    console.error('处理错误:', error);
  }
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