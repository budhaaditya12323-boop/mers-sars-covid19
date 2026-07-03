import {
    DISEASE_LABELS,
    DISEASE_NAMES,
    SYMPTOM_NAMES,
    SYMPTOM_LABELS,
    TRAINING_DATA,
    DEFAULT_SYMPTOMS,
    TOTAL_DATA,
    PRIOR,
    SMOOTH_CONST,
    NUM_SYMPTOMS
} from './data.js';

function buildCounts() {
    var counts = [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    ];

    var diseaseIndex = { P001: 0, P002: 1, P003: 2 };

    for (var i = 0; i < TRAINING_DATA.length; i++) {
        var record = TRAINING_DATA[i];
        var idxDisease = diseaseIndex[record.disease];
        for (var j = 0; j < NUM_SYMPTOMS; j++) {
            var symptomCode = SYMPTOM_NAMES[j];
            if (record[symptomCode] === 1) {
                counts[idxDisease][j] += 1;
            }
        }
    }
    return counts;
}

function calculateJoint() {
    var counts = buildCounts();
    var joint = [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    ];

    for (var h = 0; h < 3; h++) {
        for (var j = 0; j < NUM_SYMPTOMS; j++) {
            if (counts[h][j] === 0) {
                joint[h][j] = SMOOTH_CONST;
            } else {
                joint[h][j] = counts[h][j] / TOTAL_DATA; 
            }
        }
    }
    return joint;
}

function calculatePosterior(symptoms) {
    var joint = calculateJoint();

    var activeIndices = [];
    for (var i = 0; i < NUM_SYMPTOMS; i++) {
        if (symptoms[i] === 1) {
            activeIndices[activeIndices.length] = i;
        }
    }

    var pEvidence = [];
    for (var j = 0; j < NUM_SYMPTOMS; j++) {
        pEvidence[j] = joint[0][j] + joint[1][j] + joint[2][j]; 
    }

    var pHGivenE = [];
    for (var j = 0; j < NUM_SYMPTOMS; j++) {
        var vals = [];
        for (var h = 0; h < 3; h++) {
            var pE_given_H = joint[h][j] / PRIOR;
            
            // console.log("Gejala " + SYMPTOM_NAMES[j] + 
            //         ", Penyakit " + DISEASE_LABELS[h] + 
            //         ", P(E|H) = " + pE_given_H + " (" + joint[h][j] + " / " + PRIOR + ")");

            var pH_E = (pE_given_H * PRIOR) / pEvidence[j];

            // console.log("Gejala " + SYMPTOM_NAMES[j] +
            //         ", Penyakit " + DISEASE_LABELS[h] + 
            //         ", P(H|E) = " + pH_E + " (" + pE_given_H + " * " + PRIOR + " / " + pEvidence[j] + ")");
            vals[h] = pH_E;
        }
        pHGivenE[j] = vals;
    }

    var product = [1, 1, 1];
    for (var h = 0; h < 3; h++) {
        var p = 1;
        for (var idx = 0; idx < activeIndices.length; idx++) {
            var gejalaIndex = activeIndices[idx];
            p = p * pHGivenE[gejalaIndex][h];
        }
        product[h] = p;
    }

    var rawScores = [];
    var total = 0;
    for (var h = 0; h < 3; h++) {
        rawScores[h] = product[h] * PRIOR;
        total = total + rawScores[h];
    }

    var percentages = [];
    if (total === 0) {
        for (var h = 0; h < 3; h++) {
            percentages[h] = 0;
        }
    } else {
        for (var h = 0; h < 3; h++) {
            percentages[h] = (rawScores[h] / total) * 100;
        }
    }

    return {
        product: product,
        rawScores: rawScores,
        percentages: percentages,
        pHGivenE: pHGivenE,
        pEvidence: pEvidence,
        joint: joint,
        activeIndices: activeIndices
    };
}


function renderSymptoms() {
    var container = document.getElementById('symptomsContainer');
    var html = '';

    for (var i = 0; i < NUM_SYMPTOMS; i++) {
        var kode_gejala = SYMPTOM_NAMES[i];
        var nama_gejala = SYMPTOM_LABELS[kode_gejala] || kode_gejala;
        var checked = '';

        html = html +
            '<label class="flex items-center gap-1.5 bg-white border border-gray-300 hover:border-secondary rounded-full px-3 py-1.5 text-sm cursor-pointer transition shadow-sm">' +
            '   <input type="checkbox" id="chk_' + i + '" ' + checked + ' class="accent-secondary w-4 h-4" />' +
            '   ' + kode_gejala + ': ' + nama_gejala +
            '</label>';
    }

    container.innerHTML = html;
}

function getSymptoms() {
    var symptoms = [];
    for (var i = 0; i < NUM_SYMPTOMS; i++) {
        var chk = document.getElementById('chk_' + i);
        symptoms[i] = chk.checked ? 1 : 0;
    }
    return symptoms;
}

function resetSymptoms() {
    for (var i = 0; i < NUM_SYMPTOMS; i++) {
        var chk = document.getElementById('chk_' + i);
        chk.checked = false;
    }
    diagnose();
}

function diagnose() {
    var symptoms = getSymptoms();

    var activeCount = 0;
    for (var i = 0; i < symptoms.length; i++) {
        if (symptoms[i] === 1) activeCount++;
    }
    document.getElementById('activeInfo').textContent = 'Gejala aktif: ' + activeCount;

    if (activeCount === 0) {
        document.getElementById('resultDetail').innerHTML =
            '<p class="text-gray-500">⚠️ Belum ada gejala yang dipilih. Silakan centang gejala pasien.</p>';
        document.getElementById('stepContent').innerHTML =
            '<p class="text-gray-500">Belum ada perhitungan karena tidak ada gejala aktif.</p>';
        return;
    }

    var result = calculatePosterior(symptoms);

    var maxIdx = 0;
    for (var i = 1; i < 3; i++) {
        if (result.percentages[i] > result.percentages[maxIdx]) {
            maxIdx = i;
        }
    }

    var html = '<div class="overflow-x-auto"><table class="w-full text-sm border-collapse">';
    html = html + '<thead><tr class="bg-gray-200 text-gray-700">';
    html = html + '<th class="p-2 border text-left">Penyakit</th>';
    html = html + '<th class="p-2 border text-right">Skor Akhir</th>';
    html = html + '<th class="p-2 border text-right">Persentase</th>';
    html = html + '</tr></thead><tbody>';

    for (var i = 0; i < 3; i++) {
        var label = DISEASE_LABELS[i];
        var name = DISEASE_NAMES[i];
        var color = label.toLowerCase();

        html = html + '<tr class="border-b">';
        html = html + '  <td class="p-2 border">';
        html = html + '    <span class="inline-block bg-' + color + ' text-white text-xs font-bold px-3 py-1 rounded-full">';
        html = html + '      ' + label + ' - ' + name;
        html = html + '    </span>';
        html = html + '  </td>';
        html = html + '  <td class="p-2 border text-right font-mono">' + result.rawScores[i].toFixed(9) + '</td>';
        html = html + '  <td class="p-2 border text-right font-bold">' + result.percentages[i].toFixed(3) + '%</td>';
        html = html + '</tr>';
    }

    html = html + '</tbody></table></div>';

    var maxLabel = DISEASE_LABELS[maxIdx];
    var maxName = DISEASE_NAMES[maxIdx];
    var maxColor = maxLabel.toLowerCase();

    html = html + '<div class="mt-4 bg-green-100 border border-green-300 text-green-800 rounded-xl p-3 text-sm">';
    html = html + '  <strong>✅ Kesimpulan:</strong> Pasien diperkirakan menderita ';
    html = html + '  <span class="inline-block bg-' + maxColor + ' text-white text-xs font-bold px-3 py-1 rounded-full">';
    html = html + '    ' + maxLabel + ' - ' + maxName;
    html = html + '  </span>';
    html = html + '  dengan probabilitas <strong>' + result.percentages[maxIdx].toFixed(3) + '%</strong>';
    html = html + '</div>';

    document.getElementById('resultDetail').innerHTML = html;

    // ---- Detail Perhitungan (3 desimal) ----
    var stepHtml = '<div class="overflow-x-auto"><table class="w-full text-xs border-collapse">';
    stepHtml = stepHtml + '<thead><tr class="bg-gray-200 text-gray-700">';
    stepHtml = stepHtml + '<th class="p-1 border text-left">Gejala</th>';
    stepHtml = stepHtml + '<th class="p-1 border text-right">P(P001|E)</th>';
    stepHtml = stepHtml + '<th class="p-1 border text-right">P(P002|E)</th>';
    stepHtml = stepHtml + '<th class="p-1 border text-right">P(P003|E)</th>';
    stepHtml = stepHtml + '</tr></thead><tbody>';

    for (var idx = 0; idx < result.activeIndices.length; idx++) {
        var gejalaIndex = result.activeIndices[idx];
        var code = SYMPTOM_NAMES[gejalaIndex];
        var label = SYMPTOM_LABELS[code] || code;
        var vals = result.pHGivenE[gejalaIndex];

        stepHtml = stepHtml + '<tr class="border-b">';
        stepHtml = stepHtml + '  <td class="p-1 border">' + code + ': ' + label + '</td>';
        stepHtml = stepHtml + '  <td class="p-1 border text-right font-mono">' + vals[0].toFixed(9) + '</td>';
        stepHtml = stepHtml + '  <td class="p-1 border text-right font-mono">' + vals[1].toFixed(9) + '</td>';
        stepHtml = stepHtml + '  <td class="p-1 border text-right font-mono">' + vals[2].toFixed(9) + '</td>';
        stepHtml = stepHtml + '</tr>';
    }

    stepHtml = stepHtml + '</tbody></table></div>';

    stepHtml = stepHtml + '<div class="mt-3 text-xs text-gray-500">';
    stepHtml = stepHtml + '  <strong>Produk P(H|E):</strong> ';
    stepHtml = stepHtml + result.product[0].toFixed(9) + ' | ' + result.product[1].toFixed(9) + ' | ' + result.product[2].toFixed(9);
    stepHtml = stepHtml + ' &nbsp;|&nbsp; ';
    stepHtml = stepHtml + '  <strong>Skor Akhir (× Prior):</strong> ';
    stepHtml = stepHtml + result.rawScores[0].toFixed(9) + ' | ' + result.rawScores[1].toFixed(9) + ' | ' + result.rawScores[2].toFixed(9);
    stepHtml = stepHtml + '</div>';

    document.getElementById('stepContent').innerHTML = stepHtml;
}


renderSymptoms();

document.getElementById('diagnoseBtn').addEventListener('click', diagnose);
document.getElementById('resetBtn').addEventListener('click', resetSymptoms);

document.getElementById('resultDetail').innerHTML =
    '<p class="text-gray-500">💡 Silakan pilih gejala pasien, lalu klik tombol <strong>"Diagnosa"</strong>.</p>';
document.getElementById('stepContent').innerHTML =
    '<p class="text-gray-500">Belum ada perhitungan. Pilih gejala dan klik Diagnosa.</p>';
document.getElementById('activeInfo').textContent = 'Gejala aktif: 0';



// console.log("PRIOR =", PRIOR);
// console.log("SMOOTH_CONST =", SMOOTH_CONST);
// console.log("TOTAL_DATA =", TOTAL_DATA);
// console.log("First 10 training records:", TRAINING_DATA.slice(0, 10));
