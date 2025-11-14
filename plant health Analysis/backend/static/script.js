// document.addEventListener('DOMContentLoaded', () => {
//     const captureBtn = document.getElementById('captureBtn');
//     const summaryBtn = document.getElementById('summaryBtn');
//     const resultDiv = document.getElementById('result');
//     const preview = document.getElementById('preview');

//     // Capture and analyze on button click
//     if (captureBtn) {
//         captureBtn.addEventListener('click', async () => {
//             resultDiv.innerHTML = '<h5>Capturing and analyzing...</h5>';
//             try {
//                 const response = await fetch('/capture_and_analyze');
//                 const data = await response.json();
//                 if (data.status === 'ok') {
//                     const img = document.createElement('img');
//                     img.src = `data:image/jpeg;base64,${data.image_b64}`;
//                     preview.innerHTML = '';
//                     preview.appendChild(img);
//                     resultDiv.innerHTML = `<h5>Analysis Result:</h5><p>${data.analysis}</p>`;
//                 } else {
//                     resultDiv.innerHTML = `<h5>Error:</h5><p>${data.error}</p>`;
//                 }
//             } catch (e) {
//                 resultDiv.innerHTML = `<h5>Error:</h5><p>Failed to fetch analysis: ${e.message}</p>`;
//             }
//         });
//     }

//     // View summary on index page
//     if (summaryBtn) {
//         summaryBtn.addEventListener('click', async () => {
//             resultDiv.innerHTML = '<h5>Loading summary...</h5>';
//             try {
//                 const response = await fetch('/summary');
//                 const data = await response.json();
//                 if (data.error) {
//                     resultDiv.innerHTML = `<h5>Error:</h5><p>${data.error}</p>`;
//                     return;
//                 }
//                 let html = '<h5>Summary Data:</h5>';
//                 for (const [period, info] of Object.entries(data)) {
//                     html += `<h6>${period.charAt(0).toUpperCase() + period.slice(1)}:</h6>`;
//                     html += `<p>Count: ${info.count}</p>`;
//                     if (info.sample.length === 0) {
//                         html += '<p>No analyses in this period.</p>';
//                     } else {
//                         html += '<ul>';
//                         info.sample.forEach(item => {
//                             html += `<li>${item.analysis}`;
//                             if (item.image_path) {
//                                 html += `<br><img src="/static/${item.image_path}" style="max-width: 200px; height: auto; margin-top: 10px;">`;
//                             }
//                             html += '</li>';
//                         });
//                         html += '</ul>';
//                     }
//                 }
//                 resultDiv.innerHTML = html;
//             } catch (e) {
//                 resultDiv.innerHTML = `<h5>Error:</h5><p>Failed to fetch summary: ${e.message}</p>`;
//             }
//         });
//     }

//     const fetchSummaryBtn = document.getElementById('fetchSummary');
//     if (fetchSummaryBtn) {
//         fetchSummaryBtn.addEventListener('click', async () => {
//             const summaryDiv = document.getElementById('summaryResult');
//             summaryDiv.innerHTML = '<h5>Loading summary...</h5>';
//             try {
//                 const response = await fetch('/summary');
//                 const data = await response.json();
//                 if (data.error) {
//                     summaryDiv.innerHTML = `<h5>Error:</h5><p>${data.error}</p>`;
//                     return;
//                 }
//                 let html = '<h5>Summary Data:</h5>';
//                 for (const [period, info] of Object.entries(data)) {
//                     html += `<h6>${period.charAt(0).toUpperCase() + period.slice(1)}:</h6>`;
//                     html += `<p>Count: ${info.count}</p>`;
//                     if (info.sample.length === 0) {
//                         html += '<p>No analyses in this period.</p>';
//                     } else {
//                         html += '<ul>';
//                         info.sample.forEach(item => {
//                             html += `<li>${item.analysis}`;
//                             if (item.image_path) {
//                                 html += `<br><img src="/static/${item.image_path}" style="max-width: 200px; height: auto; margin-top: 10px;">`;
//                             }
//                             html += '</li>';
//                         });
//                         html += '</ul>';
//                     }
//                 }
//                 summaryDiv.innerHTML = html;
//             } catch (e) {
//                 summaryDiv.innerHTML = `<h5>Error:</h5><p>Failed to fetch summary: ${e.message}</p>`;
//             }
//         });
//     }

//     const clearLogsBtn = document.getElementById('clearLogs');
//     if (clearLogsBtn) {
//         clearLogsBtn.addEventListener('click', async () => {
//             if (confirm('Are you sure you want to clear all logs and images?')) {
//                 const response = await fetch('/clear_logs', { method: 'POST' });
//                 const data = await response.json();
//                 alert(data.status === 'cleared' ? 'Logs and images cleared successfully!' : `Error: ${data.error}`);
//                 document.getElementById('summaryResult').innerHTML = '';
//             }
//         });
//     }
// });

// document.addEventListener('DOMContentLoaded', () => {
//     const captureBtn = document.getElementById('captureBtn');
//     const summaryBtn = document.getElementById('summaryBtn');
//     const resultDiv = document.getElementById('result');
//     const preview = document.getElementById('preview');
//     const retryLink = document.getElementById('retryLink');

//     // === CAPTURE & ANALYZE ===
//     if (captureBtn) {
//         captureBtn.addEventListener('click', async () => {
//             resultDiv.innerHTML = '<p class="text-center">በመተንተን ላይ...</p>';
//             preview.innerHTML = '';
//             if (retryLink) retryLink.style.display = 'none';

//             try {
//                 const response = await fetch('/capture_and_analyze');
//                 const data = await response.json();

//                 if (data.status === 'ok') {
//                     // Show image
//                     const img = document.createElement('img');
//                     img.src = `data:image/jpeg;base64,${data.image_b64}`;
//                     img.className = 'img-fluid rounded shadow';
//                     img.style.maxHeight = '400px';
//                     preview.appendChild(img);

//                     // Parse analysis into 4 cards
//                     const lines = data.analysis.split('\n').map(l => l.trim()).filter(Boolean);

//                     const labels = [
//                         'የእፅዋት ጤና ሁኔታ፦',
//                         'የመሬት እርጥበት ደረጃ፦',
//                         'የተወሰነ የበሽታ አይነት፦',
//                         'የማሻሻያ ምክር፦'
//                     ];

//                     const keys = [
//                         'Crop health condition:',
//                         'Soil moisture level:',
//                         'Specific disease type:',
//                         'One precise improvement tip:'
//                     ];

//                     let html = '<div class="space-y-4">';
//                     lines.forEach((line, i) => {
//                         if (i < 4) {
//                             const clean = line.replace(keys[i], '').trim();
//                             html += `
//                             <div class="bg-gray-50 p-4 rounded-lg shadow">
//                                 <p class="text-gray-800"><strong>${labels[i]}</strong> ${clean}</p>
//                             </div>`;
//                         }
//                     });
//                     html += '</div>';
//                     resultDiv.innerHTML = html;

//                     // Show retry button
//                     if (retryLink) retryLink.style.display = 'block';
//                 } else {
//                     resultDiv.innerHTML = `<p class="text-danger">ስህተት፡ ${data.error}</p>`;
//                 }
//             } catch (e) {
//                 resultDiv.innerHTML = `<p class="text-danger">ግንኙነት ተቋርጧል፡ ${e.message}</p>`;
//             }
//         });
//     }

//     // === VIEW SUMMARY (on index page) ===
//     if (summaryBtn) {
//         summaryBtn.addEventListener('click', async () => {
//             window.location.href = '/summary_page';
//         });
//     }

//     // === FETCH SUMMARY (on summary page) ===
//     const fetchSummaryBtn = document.getElementById('fetchSummary');
//     if (fetchSummaryBtn) {
//         fetchSummaryBtn.addEventListener('click', async () => {
//             const summaryDiv = document.getElementById('summaryResult');
//             summaryDiv.innerHTML = '<p class="text-center">በመጫን ላይ...</p>';

//             try {
//                 const response = await fetch('/summary');
//                 const data = await response.json();

//                 if (data.error) {
//                     summaryDiv.innerHTML = `<p class="text-danger">ስህተት፡ ${data.error}</p>`;
//                     return;
//                 }

//                 let html = '<h5 class="text-success mb-3">የማጠቃለያ ውሂብ</h5>';
//                 for (const [period, info] of Object.entries(data)) {
//                     const title = period === 'hour' ? 'ሰዓት' :
//                                   period === 'day' ? 'ቀን' :
//                                   period === 'week' ? 'ሳምንት' :
//                                   period === 'month' ? 'ወር' : 'አመት';

//                     html += `<h6>${title}:</h6>`;
//                     html += `<p>ብዛት፡ ${info.count}</p>`;

//                     if (info.sample.length === 0) {
//                         html += '<p>በዚህ ጊዜ ውስጥ ምንም ትንታኔ የለም።</p>';
//                     } else {
//                         html += '<ul class="list-unstyled">';
//                         info.sample.forEach(item => {
//                             html += `<li class="mb-3 p-3 bg-light rounded shadow-sm">
//                                 <small>${item.analysis}</small>`;
//                             if (item.image_path) {
//                                 html += `<br><img src="/static/${item.image_path}" class="mt-2 img-fluid rounded" style="max-width: 200px;">`;
//                             }
//                             html += '</li>';
//                         });
//                         html += '</ul>';
//                     }
//                 }
//                 summaryDiv.innerHTML = html;
//             } catch (e) {
//                 summaryDiv.innerHTML = `<p class="text-danger">ግንኙነት ተቋርጧል፡ ${e.message}</p>`;
//             }
//         });
//     }

//     // === CLEAR LOGS ===
//     const clearLogsBtn = document.getElementById('clearLogs');
//     if (clearLogsBtn) {
//         clearLogsBtn.addEventListener('click', async () => {
//             if (confirm('እርግጠኛ ነህ? ሁሉንም መረጃ እና ፎቶዎች መሰረዝ ትፈልጋለህ?')) {
//                 const response = await fetch('/clear_logs', { method: 'POST' });
//                 const data = await response.json();
//                 alert(data.status === 'cleared'
//                     ? 'ሁሉም መረጃዎች ተሰርዘዋል!'
//                     : `ስህተት፡ ${data.error}`);
//                 document.getElementById('summaryResult').innerHTML = '';
//             }
//         });
//     }
// });

// document.addEventListener('DOMContentLoaded', () => {
//     // === CAPTURE BUTTON (on index.html) - Keep from before ===
//     const captureBtn = document.getElementById('captureBtn');
//     const resultDiv = document.getElementById('result');
//     const preview = document.getElementById('preview');
//     const retryLink = document.getElementById('retryLink');

//     if (captureBtn) {
//         captureBtn.addEventListener('click', async () => {
//             resultDiv.innerHTML = '<p class="text-center">በመተንተን ላይ...</p>';
//             preview.innerHTML = '';
//             if (retryLink) retryLink.style.display = 'none';

//             try {
//                 const response = await fetch('/capture_and_analyze');
//                 const data = await response.json();

//                 if (data.status === 'ok') {
//                     const img = document.createElement('img');
//                     img.src = `data:image/jpeg;base64,${data.image_b64}`;
//                     img.className = 'img-fluid rounded shadow';
//                     img.style.maxHeight = '400px';
//                     preview.appendChild(img);

//                     const lines = data.analysis.split('\n').map(l => l.trim()).filter(Boolean);
//                     const labels = ['የእፅዋት ጤና ሁኔታ፦', 'የመሬት እርጥበት ደረጃ፦', 'የተወሰነ የበሽታ አይነት፦', 'የማሻሻያ ምክር፦'];
//                     const keys = ['Crop health condition:', 'Soil moisture level:', 'Specific disease type:', 'One precise improvement tip:'];

//                     let html = '<div class="space-y-4">';
//                     lines.forEach((line, i) => {
//                         if (i < 4) {
//                             const clean = line.replace(keys[i], '').trim();
//                             html += `
//                             <div class="bg-light-green p-4 rounded-lg shadow">
//                                 <p class="text-gray-800"><strong>${labels[i]}</strong> ${clean}</p>
//                             </div>`;
//                         }
//                     });
//                     html += '</div>';
//                     resultDiv.innerHTML = html;

//                     if (retryLink) retryLink.style.display = 'block';
//                 } else {
//                     resultDiv.innerHTML = `<p class="text-danger">ስህተት፡ ${data.error}</p>`;
//                 }
//             } catch (e) {
//                 resultDiv.innerHTML = `<p class="text-danger">ግንኙነት ተቋርጧል፡ ${e.message}</p>`;
//             }
//         });
//     }

//     // === SUMMARY PAGE: TABBED VIEW ===
//     const periodButtons = document.querySelectorAll('.period-btn');
//     const summaryDiv = document.getElementById('summaryResult');
//     let allData = {};

//     if (periodButtons.length > 0) {
//         async function loadAllData() {
//             summaryDiv.innerHTML = '<p class="text-center text-muted">በመጫን ላይ...</p>';
//             try {
//                 const res = await fetch('/summary');
//                 const data = await res.json();
//                 if (data.error) throw new Error(data.error);
//                 allData = data;
//                 showPeriod('year');
//             } catch (e) {
//                 summaryDiv.innerHTML = `<p class="text-danger text-center">ስህተት፡ ${e.message}</p>`;
//             }
//         }

//         function showPeriod(period) {
//             const info = allData[period];
//             if (!info) return;

//             const periodNames = {hour:'ሰዓት', day:'ቀን', week:'ሳምንት', month:'ወር', year:'አመት'};
//             let html = `<div class="text-center mb-4"><span class="count-badge">${periodNames[period]} – ብዛት፡ ${info.count}</span></div>`;

//             if (info.sample.length === 0) {
//                 html += `<p class="text-muted text-center">ምንም ትንታኔ የለም።</p>`;
//             } else {
//                 info.sample.forEach(item => {
//                     const lines = item.analysis.split('\n').map(l => l.trim()).filter(Boolean);
//                     const labels = ['የእፅዋት ጤና ሁኔታ፦','የመሬት እርጥበት ደረጃ፦','የተወሰነ የበሽታ አይነት፦','የማሻሻያ ምክር፦'];
//                     const keys   = ['Crop health condition:','Soil moisture level:','Specific disease type:','One precise improvement tip:'];

//                     let card = '<div class="space-y-3">';
//                     lines.forEach((l, i) => {
//                         if (i < 4) {
//                             const clean = l.replace(keys[i], '').trim();
//                             card += `
//                             <div class="bg-light-green p-3 rounded">
//                                 <p class="mb-0"><strong>${labels[i]}</strong> ${clean}</p>
//                             </div>`;
//                         }
//                     });
//                     card += '</div>';

//                     html += `
//                     <div class="analysis-card">
//                         ${card}
//                         ${item.image_path ? `<div class="text-center mt-3"><img src="/static/${item.image_path}" class="img-thumb"></div>` : ''}
//                     </div>`;
//                 });
//             }
//             summaryDiv.innerHTML = html;
//         }

//         periodButtons.forEach(btn => {
//             btn.addEventListener('click', () => {
//                 periodButtons.forEach(b => b.classList.remove('active'));
//                 btn.classList.add('active');
//                 showPeriod(btn.dataset.period);
//             });
//         });

//         loadAllData();
//     }

//     // === CLEAR LOGS ===
//     const clearLogsBtn = document.getElementById('clearLogs');
//     if (clearLogsBtn) {
//         clearLogsBtn.addEventListener('click', async () => {
//             if (confirm('እርግጠኛ ነህ? ሁሉንም መረጃ እና ፎቶዎች መሰረዝ ትፈልጋለህ?')) {
//                 const res = await fetch('/clear_logs', { method: 'POST' });
//                 const data = await res.json();
//                 alert(data.status === 'cleared' ? 'ሁሉም ተሰርዟል!' : `ስህተት፡ ${data.error}`);
//                 location.reload();
//             }
//         });
//     }
// });

document.addEventListener('DOMContentLoaded', () => {
    // === ELEMENTS ===
    const captureBtn = document.getElementById('captureBtn');
    const resultDiv = document.getElementById('result');
    const preview = document.getElementById('preview');
    const retryLink = document.getElementById('retryLink');

    const periodButtons = document.querySelectorAll('.period-btn');
    const summaryDiv = document.getElementById('summaryResult');
    const clearLogsBtn = document.getElementById('clearLogs');

    let allData = {};

    // === 5 LABELS & KEYS (MUST MATCH PROMPT ORDER) ===
    const LABELS = [
        'የእፅዋት ጤና ሁኔታ፦',
        'የመሬት እርጥበት ደረጃ፦',
        'የተክል አይነት፦',
        'የተወሰነ የበሽታ አይነት፦',
        'የማሻሻያ ምክር፦'
    ];

    const KEYS = [
        'የእፅዋት ጤና ሁኔታ',
        'የመሬት እርጥበት ደረጃ',
        'የተክል አይነት',
        'የተወሰነ የበሽታ አይነት',
        'የማሻሻያ ምክር'
    ];

    // === RENDER 5 CARDS FROM TEXT ===
    function renderAnalysis(text, container) {
        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        let html = '<div class="space-y-4">';

        lines.forEach((line, i) => {
            if (i < 5) {
                const clean = line.replace(KEYS[i], '').trim();
                html += `
                <div class="bg-light-green p-4 rounded-lg shadow">
                    <p class="text-gray-800 mb-0"><strong>${LABELS[i]}</strong> ${clean}</p>
                </div>`;
            }
        });
        html += '</div>';
        container.innerHTML = html;
    }

    // === CAPTURE & ANALYZE (INDEX PAGE) ===
    if (captureBtn) {
        captureBtn.addEventListener('click', async () => {
            resultDiv.innerHTML = '<p class="text-center text-muted">በመተንተን ላይ...</p>';
            preview.innerHTML = '';
            if (retryLink) retryLink.style.display = 'none';

            try {
                const res = await fetch('/capture_and_analyze');
                const data = await res.json();

                if (data.status === 'ok') {
                    // Show image
                    const img = document.createElement('img');
                    img.src = `data:image/jpeg;base64,${data.image_b64}`;
                    img.className = 'img-fluid rounded shadow';
                    img.style.maxHeight = '400px';
                    preview.appendChild(img);

                    // Show 5 cards
                    renderAnalysis(data.analysis, resultDiv);

                    if (retryLink) retryLink.style.display = 'block';
                } else {
                    resultDiv.innerHTML = `<p class="text-danger text-center">ስህተት፡ ${data.error}</p>`;
                }
            } catch (e) {
                resultDiv.innerHTML = `<p class="text-danger text-center">ግንኙነት ተቋርጧል፡ ${e.message}</p>`;
            }
        });
    }

    // === SUMMARY PAGE: TABBED VIEW ===
    if (periodButtons.length > 0) {
        async function loadData() {
            summaryDiv.innerHTML = '<p class="text-center text-muted">በመጫን ላይ...</p>';
            try {
                const res = await fetch('/summary');
                const data = await res.json();
                if (data.error) throw new Error(data.error);
                allData = data;
                showPeriod('year');
            } catch (e) {
                summaryDiv.innerHTML = `<p class="text-danger text-center">ስህተት፡ ${e.message}</p>`;
            }
        }

        function showPeriod(period) {
            const info = allData[period];
            if (!info) return;

            const names = {hour:'ሰዓት', day:'ቀን', week:'ሳምንት', month:'ወር', year:'አመት'};
            let html = `<div class="text-center mb-4"><span class="count-badge">${names[period]} – ብዛት፡ ${info.count}</span></div>`;

            if (info.sample.length === 0) {
                html += `<p class="text-muted text-center">ምንም ትንታኔ የለም።</p>`;
            } else {
                info.sample.forEach(item => {
                    let card = '<div class="space-y-3">';
                    const lines = item.analysis.split('\n').map(l => l.trim()).filter(Boolean);
                    lines.forEach((l, i) => {
                        if (i < 5) {
                            const clean = l.replace(KEYS[i], '').trim();
                            card += `
                            <div class="bg-light-green p-3 rounded">
                                <p class="mb-0"><strong>${LABELS[i]}</strong> ${clean}</p>
                            </div>`;
                        }
                    });
                    card += '</div>';

                    html += `
                    <div class="analysis-card">
                        ${card}
                        ${item.image_path ? `<div class="text-center mt-3"><img src="/static/${item.image_path}" class="img-thumb"></div>` : ''}
                    </div>`;
                });
            }
            summaryDiv.innerHTML = html;
        }

        periodButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                periodButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                showPeriod(btn.dataset.period);
            });
        });

        loadData();
    }

    // === CLEAR LOGS ===
    if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', async () => {
            if (confirm('እርግጠኛ ነህ? ሁሉንም መረጃ እና ፎቶዎች መሰረዝ ትፈልጋለህ?')) {
                const res = await fetch('/clear_logs', { method: 'POST' });
                const data = await res.json();
                alert(data.status === 'cleared' ? 'ሁሉም ተሰርዟል!' : `ስህተት፡ ${data.error}`);
                location.reload();
            }
        });
    }
});