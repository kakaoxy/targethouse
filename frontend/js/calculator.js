// calculator.js

// 获取输入值
const form = {
    totalPrice: 200,
    area: 55,
    expectedPrice: 230,
    salesCycle: 4,
    merchantRatio: 50,
};

// 验证输入
function validateInputs() {
    const warnings = [];
    if (!form.totalPrice || form.totalPrice <= 0) {
        warnings.push('请输入有效的房屋总价');
    }
    if (!form.area || form.area <= 0) {
        warnings.push('请输入有效的建筑面积');
    }
    if (!form.expectedPrice || form.expectedPrice <= 0) {
        warnings.push('请输入有效的预期售价');
    }
    if (!form.salesCycle || form.salesCycle <= 0) {
        warnings.push('请输入有效的销售周期');
    }
    if (!form.merchantRatio || form.merchantRatio <= 0 || form.merchantRatio >= 100) {
        warnings.push('请输入有效的商户占比（1-99）');
    }
    return warnings;
}

// 格式化金额
function formatMoney(number) {
    return Math.round(number).toLocaleString('zh-CN');
}

// 计算收益率
function calculateReturnRate(totalReturn, investment) {
    if (!investment) return 0;
    return Math.round((totalReturn / investment - 1) * 100);
}

// 主计算函数
function calculate() {
    console.log('Calculating...');
    
    // 获取结果区域元素
    const resultsDiv = document.getElementById('results');
    const warningsDiv = document.getElementById('warnings');
    
    if (!resultsDiv || !warningsDiv) {
        console.error('Required DOM elements not found');
        return;
    }

    // 清空警告信息
    warningsDiv.innerHTML = '';
    
    // 验证输入
    const warnings = validateInputs();
    if (warnings.length > 0) {
        warnings.forEach(warning => {
            warningsDiv.innerHTML += `<div class="warning">${warning}</div>`;
        });
        resultsDiv.style.display = 'none';
        return;
    }

    // 1. 基础费用计算
    const purchaseCommission = form.totalPrice * 0.01 * 10000;  // 收房佣金
    const renovationCost = form.area * 2200;                    // 装修费
    const saleCommission = form.expectedPrice * 0.01 * 10000;   // 卖房佣金
    
    // 总投资
    const totalInvestment = purchaseCommission + renovationCost + saleCommission;
    
    // 2. 投资分配计算
    const meifangbaoRatio = (100 - form.merchantRatio) / 100;  // 美房宝出资占比
    const meifangbaoActualRatio = meifangbaoRatio * 0.3;       // 美房宝实际出资比例
    const fangduoduoRatio = meifangbaoRatio * 0.7;             // 资方配资比例
    
    const merchantInvestment = totalInvestment * (form.merchantRatio / 100);
    const meifangbaoActualInvestment = totalInvestment * meifangbaoActualRatio;
    const fangduoduoInvestment = totalInvestment * fangduoduoRatio;
    
    // 3. 溢价计算
    const premium = (form.expectedPrice - form.totalPrice) * 10000;
    
    // 4. 计算剩余溢价（扣除总投资后）
    const remainingPremium = premium - totalInvestment;
    
    // 5. 运营费用计算
    const maxOperationalCost = form.expectedPrice * 10000 * 0.01;  // 预期售价的1%
    const operationalCost = remainingPremium > 0 
        ? Math.min(remainingPremium, maxOperationalCost)  // 如果有剩余溢价，取剩余溢价和最大运营费用的较小值
        : 0;  // 如果没有剩余溢价，运营费用为0
    
    // 6. 计算总利润（剩余溢价减去运营费用）
    const totalProfit = remainingPremium - operationalCost;
    
    // 7. 分配各方利润和本金回收
    let merchantProfit = 0;
    let meifangbaoProfit = 0;
    let fangduoduoProfit = 0;
    
    // 显示溢价不足的警告
    if (premium < totalInvestment) {
        warningsDiv.innerHTML = '<div class="warning">警告：溢价不足以覆盖总投资，项目亏损！</div>';
        
        // 计算总亏损
        const totalLoss = premium - totalInvestment;
        
        // 商户承担一半亏损
        merchantProfit = totalLoss / 2;
        
        // 美房宝方承担另一半亏损
        const meifangbaoSideLoss = totalLoss / 2;
        
        // 判断美房宝方的亏损是否超过美房宝投资
        if (Math.abs(meifangbaoSideLoss) <= meifangbaoActualInvestment) {
            // 如果亏损小于等于美房宝投资，美房宝承担全部亏损
            meifangbaoProfit = meifangbaoSideLoss;
            fangduoduoProfit = 0;
        } else {
            // 如果亏损超过美房宝投资，美房宝亏损全部投资，剩余亏损由资方承担
            meifangbaoProfit = -meifangbaoActualInvestment;
            // 资方回款 = (美房宝投资 - 总亏损/2) + 资方投资
            fangduoduoProfit = (meifangbaoActualInvestment - Math.abs(meifangbaoSideLoss));
        }
        
        // 添加额外警告信息
        if (Math.abs(meifangbaoSideLoss) > meifangbaoActualInvestment) {
            warningsDiv.innerHTML += '<div class="warning">提示：美房宝投资已完全亏损，部分亏损转由资方承担</div>';
        }
    } else if (totalProfit > 0) {
        // 按投资比例分配总利润
        merchantProfit = totalProfit * (form.merchantRatio / 100);
        const meifangbaoTotalProfit = totalProfit * (1 - form.merchantRatio / 100);
        
        // 资方最低收益要求
        const fangduoduoMinReturn = fangduoduoInvestment * 0.08 * (form.salesCycle / 12);
        
        // 先满足资方最低收益要求
        if (meifangbaoTotalProfit >= fangduoduoMinReturn) {
            // 如果总利润足够支付资方最低收益
            fangduoduoProfit = fangduoduoMinReturn;
            
            // 剩余利润按7:3分配给美房宝和资方
            const remainingProfit = meifangbaoTotalProfit - fangduoduoMinReturn;
            fangduoduoProfit += remainingProfit * 0.3;  // 资方额外获得30%的剩余利润
            meifangbaoProfit = remainingProfit * 0.7;   // 美房宝获得70%的剩余利润
        } else {
            // 总利润不足以支付资方最低收益，全部给资方
            fangduoduoProfit = meifangbaoTotalProfit;
            meifangbaoProfit = 0;
            warningsDiv.innerHTML += '<div class="warning">提示：总利润不足以支付资方最低收益要求</div>';
        }
    } else {
        // 如果是亏损，商户按投资比例承担亏损
        merchantProfit = totalProfit * (form.merchantRatio / 100);
        const meifangbaoTotalLoss = totalProfit * (1 - form.merchantRatio / 100);
        
        // 美房宝方的亏损处理：先由美房宝承担，超出部分由资方承担
        if (Math.abs(meifangbaoTotalLoss) <= meifangbaoActualInvestment) {
            // 如果亏损小于等于美房宝投资，美房宝承担全部亏损
            meifangbaoProfit = meifangbaoTotalLoss;
            fangduoduoProfit = 0;
        } else {
            // 如果亏损超过美房宝投资，美房宝亏损全部投资，剩余亏损由资方承担
            meifangbaoProfit = -meifangbaoActualInvestment;
            fangduoduoProfit = meifangbaoTotalLoss + meifangbaoActualInvestment;
        }
    }
    
    // 8. 计算各方回款
    const merchantReturn = merchantInvestment + merchantProfit;
    const meifangbaoReturn = meifangbaoActualInvestment + meifangbaoProfit;
    const fangduoduoReturn = fangduoduoInvestment + fangduoduoProfit;
    
    // 验证利润平衡
    console.log('利润验证：', {
        '总利润': totalProfit,
        '商户利润': merchantProfit,
        '美房宝利润': meifangbaoProfit,
        '资方利润': fangduoduoProfit,
        '美房宝+资方利润': meifangbaoProfit + fangduoduoProfit,
        '商户占比': form.merchantRatio + '%',
        '美房宝方占比': (100 - form.merchantRatio) + '%'
    });
    
    // 9. 显示结果
    // 基础费用
    document.getElementById('purchaseCommission').textContent = `${formatMoney(purchaseCommission)}元`;
    document.getElementById('renovationCost').textContent = `${formatMoney(renovationCost)}元`;
    document.getElementById('saleCommission').textContent = `${formatMoney(saleCommission)}元`;
    document.getElementById('totalInvestment').textContent = `${formatMoney(totalInvestment)}元`;
    document.getElementById('premium').textContent = `${formatMoney(premium)}元`;
    document.getElementById('operationalCost').textContent = `${formatMoney(operationalCost)}元`;

    // 商户方结果
    document.getElementById('merchant-ratio').textContent = `${form.merchantRatio}%`;
    document.getElementById('merchant-investment').textContent = `${formatMoney(merchantInvestment)}元`;
    document.getElementById('merchant-return').textContent = `${formatMoney(merchantReturn)}元`;
    const merchantProfitElement = document.getElementById('merchant-profit');
    merchantProfitElement.textContent = `${formatMoney(merchantProfit)}元`;
    merchantProfitElement.classList.toggle('negative', merchantProfit < 0);
    document.getElementById('merchant-rate').textContent = `${calculateReturnRate(merchantReturn, merchantInvestment)}%`;

    // 美房宝结果
    document.getElementById('meifangbao-ratio').textContent = `${(meifangbaoActualRatio * 100).toFixed(1)}%`;
    document.getElementById('meifangbao-investment').textContent = `${formatMoney(meifangbaoActualInvestment)}元`;
    document.getElementById('meifangbao-return').textContent = `${formatMoney(meifangbaoReturn)}元`;
    const meifangbaoProfitElement = document.getElementById('meifangbao-profit');
    meifangbaoProfitElement.textContent = `${formatMoney(meifangbaoProfit)}元`;
    meifangbaoProfitElement.classList.toggle('negative', meifangbaoProfit < 0);
    document.getElementById('meifangbao-rate').textContent = `${calculateReturnRate(meifangbaoReturn, meifangbaoActualInvestment)}%`;

    // 资方结果
    document.getElementById('fangduoduo-ratio').textContent = `${(fangduoduoRatio * 100).toFixed(1)}%`;
    document.getElementById('fangduoduo-investment').textContent = `${formatMoney(fangduoduoInvestment)}元`;
    document.getElementById('fangduoduo-return').textContent = `${formatMoney(fangduoduoReturn)}元`;
    const fangduoduoProfitElement = document.getElementById('fangduoduo-profit');
    fangduoduoProfitElement.textContent = `${formatMoney(fangduoduoProfit)}元`;
    fangduoduoProfitElement.classList.toggle('negative', fangduoduoProfit < 0);
    document.getElementById('fangduoduo-rate').textContent = `${calculateReturnRate(fangduoduoReturn, fangduoduoInvestment)}%`;

    // 显示结果区域
    resultsDiv.style.display = 'block';
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    // 绑定输入框事件
    const inputs = ['totalPrice', 'area', 'expectedPrice', 'salesCycle', 'merchantRatio'];
    inputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', (e) => {
                form[id] = parseFloat(e.target.value) || 0;
            });
            // 设置初始值
            form[id] = parseFloat(input.value) || 0;
        }
    });

    // 绑定计算按钮
    const calculateButton = document.getElementById('calculate-button');
    if (calculateButton) {
        calculateButton.addEventListener('click', calculate);
    }
});
