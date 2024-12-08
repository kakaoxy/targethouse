let crawledData = null;
let currentType = 'sold'; // 当前爬取类型：sold或onSale

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

// 添加标签切换事件
document.querySelectorAll('.tab-button').forEach(button => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    currentType = button.dataset.type;
  });
});

// 修改爬取按钮事件
document.getElementById('crawlBtn').addEventListener('click', async () => {
  const statusDiv = document.getElementById('status');
  const btn = document.getElementById('crawlBtn');
  let progressDiv = document.querySelector('.progress');
  
  try {
    btn.disabled = true;
    statusDiv.textContent = '正在爬取数据，请稍候...';
    
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    // 创建或重置进度条
    if (!progressDiv) {
      progressDiv = document.createElement('div');
      progressDiv.className = 'progress';
      statusDiv.after(progressDiv);
    }
    progressDiv.style.display = 'none';
    progressDiv.innerHTML = `
      <div class="progress-bar">
        <div class="progress-fill"></div>
      </div>
      <div class="progress-text"></div>
    `;

    // 创建端口连接监听
    chrome.runtime.onConnect.addListener((port) => {
      if (port.name === "crawlProgress") {
        port.onMessage.addListener((response) => {
          try {
            if (!response.success) {
              throw new Error(response.error || '爬取失败');
            }

            if (response.type === 'progress') {
              const progress = response.progress;
              switch (progress.type) {
                case 'total':
                  progressDiv.style.display = 'block';
                  statusDiv.textContent = `共找到 ${progress.total} 个房源`;
                  break;
                case 'progress':
                  progressDiv.style.display = 'block';
                  const percent = (progress.current / progress.total * 100).toFixed(1);
                  progressDiv.querySelector('.progress-fill').style.width = `${percent}%`;
                  progressDiv.querySelector('.progress-text').textContent = progress.message;
                  break;
                case 'error':
                  console.warn(progress.message);
                  break;
                case 'complete':
                  progressDiv.style.display = 'none';
                  statusDiv.textContent = `爬取完成，共获取 ${progress.total} 条记录`;
                  break;
              }
            }
          } catch (error) {
            statusDiv.textContent = '错误：' + error.message;
            console.error('消息处理错误:', error);
            btn.disabled = false;
            progressDiv.style.display = 'none';
          }
        });
      }
    });

    // 发送爬取命令
    const action = tab.url.includes('.ke.com/chengjiao/c') ? 'crawl' : 'crawlOnSale';
    chrome.tabs.sendMessage(tab.id, {action: action}, (response) => {
      if (response && response.type === 'data') {
        if (!response.data || response.data.length === 0) {
          statusDiv.textContent = '未找到房源数据';
          btn.disabled = false;
          return;
        }
        
        // 显示数据预览和保存按钮
        statusDiv.textContent = `已找到 ${response.data.length} 条记录，请确认数据是否正确：`;
        crawledData = response.data;
        showPreview(response.data);
        
        // 显示确认和取消按钮
        document.querySelector('.buttons').style.display = 'block';
        
        // 数据获取完成后启用按钮
        btn.disabled = false;
        
        // 滚动到预览区域
        document.getElementById('previewArea').scrollIntoView({ behavior: 'smooth' });
      }
    });

  } catch (error) {
    statusDiv.textContent = '错误：' + error.message;
    console.error('操作错误:', error);
    btn.disabled = false;
  }
});

// 确认按钮事件
document.getElementById('confirmBtn').addEventListener('click', async () => {
  if (!crawledData) return;
  
  const statusDiv = document.getElementById('status');
  const btn = document.getElementById('confirmBtn');
  btn.disabled = true;
  
  try {
    statusDiv.textContent = '正在处理数据...';
    
    // 1. 保存为CSV文件
    chrome.runtime.sendMessage({
      action: 'exportExcel',
      data: crawledData
    }, async (result) => {
      if (chrome.runtime.lastError) {
        statusDiv.textContent = '导出CSV失败：' + chrome.runtime.lastError.message;
        console.error('导出错误:', chrome.runtime.lastError);
        btn.disabled = false;
        return;
      }
      
      if (!result || !result.success) {
        statusDiv.textContent = '导出CSV失败：' + (result?.error || '未知错误');
        console.error('导出失败:', result?.error);
        btn.disabled = false;
        return;
      }
      
      // 2. 调用后端API保存数据
      try {
        statusDiv.textContent = '正在保存到数据库...';
        
        // 根据当前页面URL判断调用哪个API
        const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
        const apiEndpoint = tab.url.includes('.ke.com/chengjiao/c') 
          ? '/api/houses/sold' 
          : '/api/houses/on-sale';

        // 确保每条记录都包含城市信息
        const dataToSave = crawledData.map(record => {
          if (!record['城市']) {
            console.warn('记录缺少城市信息:', record);
          }
          return record;
        });
        
        const response = await fetch(`http://localhost:8000${apiEndpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(dataToSave)
        });
        
        const apiResult = await response.json();
        
        if (!response.ok) {
          throw new Error(apiResult.detail || '保存到数据库失败');
        }
        
        console.log('API响应:', apiResult);
        
        // 3. 显示完成信息
        statusDiv.textContent = `处理完成！
          CSV文件已保存（下载ID: ${result.downloadId}）
          数据库新增: ${apiResult.inserted_count} 条记录
          ${apiResult.message || ''}`;
        
        // 隐藏预览和按钮
        document.getElementById('previewArea').style.display = 'none';
        document.querySelector('.buttons').style.display = 'none';
        
      } catch (error) {
        console.error('API调用错误:', error);
        statusDiv.textContent = `CSV已保存，但数据库保存失败: ${error.message}`;
      } finally {
        btn.disabled = false;
      }
    });
  } catch (error) {
    statusDiv.textContent = '处理失败：' + error.message;
    console.error('处理错误:', error);
    btn.disabled = false;
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