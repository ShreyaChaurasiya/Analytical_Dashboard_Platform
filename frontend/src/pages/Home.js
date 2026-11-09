import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { apiRequest } from "../api/client";
import "./Home.css";

const rainfall = [
    { month: "June", observed: 189.0, normal: 163.6, departure: 16 },
    { month: "July", observed: 240.8, normal: 289.2, departure: -17 },
    { month: "August", observed: 204.2, normal: 261.3, departure: -22 },
    { month: "September", observed: 131.8, normal: 173.4, departure: -24 },
];

const chartSource = "https://hydro.imd.gov.in/hydrometweb/%28S%28qwluyvfwmga5piyqyzrlif55%29%29/PRODUCTS/Publications/Rainfall%20Statistics%20of%20India%20-%202015/Rainfall%20Statistics%20of%20India%20-%202015.pdf";

const examples = {
    rainfall: {
        title: "India rainfall", sourceLabel: "IMD historical data · 2015", source: "India Meteorological Department, Rainfall Statistics of India — 2015", sourceUrl: chartSource,
        period: "South-West monsoon · 2015", measure: "Rainfall · millimetres", status: "Historical sample",
        summary: [["Period", "Jun–Sep 2015"], ["Observed total", "765.8 mm"], ["Vs. normal", "−14%"]],
        columns: ["Month", "Observed", "Normal", "Departure"], rows: rainfall.map((d) => [d.month, `${d.observed.toFixed(1)} mm`, `${d.normal.toFixed(1)} mm`, `${d.departure > 0 ? "+" : "−"}${Math.abs(d.departure)}%`]),
        insight: "June was 16% above normal; rainfall was below normal in each of the next three months.",
        views: [
            { title: "Monthly rainfall: observed and normal", description: "All-India South-West monsoon · millimetres", type: "line", plot: "rain-monthly" },
            { title: "Departure from normal by month", description: "Observed rainfall compared with monthly normal · percent", type: "bar", plot: "rain-departure", insight: "The shortfall deepened after June: −17% in July, −22% in August, and −24% in September." },
            { title: "Season total: observed and normal", description: "All-India South-West monsoon · June to September · millimetres", type: "bar", plot: "rain-total", insight: "The season total was 121.7 mm below the 887.5 mm normal, a 14% shortfall." },
        ],
    },
    cpi: {
        title: "Consumer prices", sourceLabel: "MoSPI CPI · Jan 2025", source: "MoSPI, CPI Press Release — January 2025", sourceUrl: "https://cpi.mospi.gov.in/PDFile/Press/PR%20January%202025.pdf",
        period: "December 2024–January 2025", measure: "Food inflation · percent", status: "Historical sample",
        summary: [["Period", "Dec 2024–Jan 2025"], ["Rural food inflation", "8.65% → 6.31%"], ["Urban food inflation", "7.90% → 5.53%"]],
        columns: ["Sector", "December 2024", "January 2025", "Change"], rows: [["Rural", "8.65%", "6.31%", "−2.34 pp"], ["Urban", "7.90%", "5.53%", "−2.37 pp"]],
        insight: "Food inflation fell in both sectors. These are rates of price change, not price index levels.",
        views: [
            { title: "Food inflation by sector", description: "Year-on-year rate · December 2024 and January 2025 · percent", type: "line", plot: "cpi-line" },
            { title: "Food inflation rates", description: "Rural and urban sectors · percent", type: "bar", plot: "cpi-bar" },
        ],
    },
    market: {
        title: "Market returns", sourceLabel: "NSE Indices · 31 Dec 2024", source: "NSE Indices, Index Dashboard — 31 December 2024", sourceUrl: "https://www.niftyindices.com/Index_Dashboard/Index_Dashboard_DEC2024.pdf",
        period: "Returns to 31 December 2024", measure: "NIFTY 50 return · percent", status: "Historical sample",
        summary: [["Report date", "31 Dec 2024"], ["1-month return", "−2.02%"], ["1-year return", "+10.09%"]],
        columns: ["Horizon", "NIFTY 50 return"], rows: [["1 month", "−2.02%"], ["3 months", "−8.25%"], ["1 year", "+10.09%"]],
        insight: "The index was down over one and three months but positive over one year at this report date.",
        views: [{ title: "NIFTY 50 returns by horizon", description: "Index returns as at 31 December 2024 · percent", type: "bar", plot: "market-bar" }],
    },
    education: {
        title: "Education statistics", sourceLabel: "UDISE+ · 2023–24", source: "Ministry of Education, UDISE+ Report — 2023–24", sourceUrl: "https://dsel.education.gov.in/sites/default/files/statistics/report_in_PDF/udise_report_existing_23_24.pdf",
        period: "Academic year · 2023–24", measure: "Pupil–teacher ratio · pupils per teacher", status: "Historical sample",
        summary: [["Academic year", "2023–24"], ["Enrolment · India", "248.0 million"], ["Schools · India", "1,471,891"]],
        columns: ["Region", "Average enrolment per school", "Pupils per teacher"], rows: [["India", "169", "25"], ["Bihar", "225", "32"], ["Delhi", "820", "28"], ["Kerala", "396", "22"]],
        insight: "Scatter compares average enrolment per school with pupils per teacher. Distribution views use state and union territory pupil–teacher ratios.",
        views: [
            { title: "Pupil–teacher ratio by region", description: "Selected UDISE+ examples · pupils per teacher", type: "bar", plot: "education-bar" },
            { title: "Relationship between school size and staffing", description: "Average enrolment per school vs pupils per teacher", type: "scatter", plot: "education-scatter" },
            { title: "Pupil–teacher ratio distribution", description: "36 states and union territories · pupils per teacher", type: "histogram", plot: "education-histogram" },
            { title: "Pupil–teacher ratio spread", description: "Median, quartiles and range · 36 states/UTs", type: "boxplot", plot: "education-boxplot" },
            { title: "Enrolment share in selected states", description: "Bihar, Delhi and Kerala · share of their combined enrolment", type: "pie", plot: "education-pie" },
        ],
    },
    health: {
        title: "Health indicators", sourceLabel: "NFHS survey rounds", source: "NFHS-4 and NFHS-5 state fact sheets; Government of India parliamentary data", sourceUrl: "https://www.data.gov.in/resource/all-india-and-stateut-wise-factsheets-national-family-health-survey-nfhs-5-2019-2021",
        period: "NFHS-4 vs NFHS-5 · survey rounds", measure: "Institutional births · percent", status: "Historical sample",
        summary: [["Survey rounds", "NFHS-4 to NFHS-5"], ["India", "78.9% → 88.6%"], ["Bihar", "63.8% → 76.2%"]],
        columns: ["Region", "NFHS-4", "NFHS-5", "Change"], rows: [["India", "78.9%", "88.6%", "+9.7 pp"], ["Bihar", "63.8%", "76.2%", "+12.4 pp"], ["Kerala", "99.8%", "99.8%", "0.0 pp"], ["Assam", "70.6%", "84.1%", "+13.5 pp"]],
        insight: "Institutional births rose in India and Bihar between survey rounds; Kerala remained at 99.8%. These are survey estimates, not live counts.",
        views: [
            { title: "Institutional births across survey rounds", description: "Percentage of births in health facilities · NFHS-4 and NFHS-5", type: "line", plot: "health-line" },
            { title: "Institutional births by region", description: "NFHS-4 and NFHS-5 · percent", type: "bar", plot: "health-bar" },
            { title: "India institutional births · NFHS-5", description: "Births in a health facility compared with outside · percent", type: "pie", plot: "health-pie" },
        ],
    },
    aqi: {
        title: "Air quality", sourceLabel: "CPCB reference bands", source: "Central Pollution Control Board, National AQI framework", sourceUrl: "https://app.cpcbccr.com/AQIIndia",
        period: "AQI bands · reference thresholds", measure: "AQI · index points", status: "Reference thresholds",
        summary: [["Measure", "AQI category ranges"], ["Categories", "6 bands"], ["Scale", "0–500"]],
        columns: ["AQI range", "Category", "Interpretation"], rows: [["0–50", "Good", "Minimal impact"], ["51–100", "Satisfactory", "Minor discomfort to sensitive people"], ["101–200", "Moderate", "Discomfort for sensitive groups"], ["201–300", "Poor", "Discomfort on prolonged exposure"], ["301–400", "Very Poor", "Respiratory illness on prolonged exposure"], ["401–500", "Severe", "Serious effects, especially for sensitive groups"]],
        insight: "These are AQI category thresholds, not current station readings. Check the pollutant and observation time when reading live AQI data.",
        views: [{ title: "CPCB AQI category thresholds", description: "National Air Quality Index · category upper bound", type: "bar", plot: "aqi-bar" }],
    },
};

const stateRatios = [13, 26, 13, 20, 32, 26, 21, 28, 28, 21, 29, 22, 14, 16, 35, 27, 22, 9, 14, 24, 29, 16, 19, 13, 13, 23, 19, 22, 22, 8, 24, 21, 18, 27, 18, 31];

function MonthlyRainfallChart() {
    const x = [70, 238, 406, 574];
    const y = (value) => 145 - (value / 320) * 120;
    const line = (key) => rainfall.map((item, index) => `${index === 0 ? "M" : "L"}${x[index]},${y(item[key]).toFixed(1)}`).join(" ");
    return <>
        <div className="rain-chart-layout"><div className="rain-chart-y-axis" aria-hidden="true"><span>300</span><span>200</span><span>100</span><span>0</span></div>
            <svg className="rain-chart-svg" viewBox="0 0 620 160" role="img" aria-label="Observed and normal monthly rainfall, June to September 2015, in millimetres.">
                {[30, 68, 106, 144].map((py) => <path key={py} className="rain-gridline" d={`M38 ${py}H605`} />)}
                <path className="rain-series-normal" d={line("normal")} /><path className="rain-series-observed" d={line("observed")} />
                {rainfall.map((item, index) => <circle key={item.month} className="rain-point" cx={x[index]} cy={y(item.observed)} r="4.5"><title>{item.month}: {item.observed} mm observed</title></circle>)}
            </svg>
        </div>
        <div className="rain-chart-axis"><span>June</span><span>July</span><span>August</span><span>September</span></div>
    </>;
}

function RainfallChart({ type }) {
    if (type === "rain-monthly") return <MonthlyRainfallChart />;
    if (type === "rain-departure") {
        const zero = 75;
        const scale = 2.15;
        return <>
            <svg className="rain-chart-svg" viewBox="0 0 620 160" role="img" aria-label="Monthly rainfall departure from normal: plus 16, minus 17, minus 22, and minus 24 percent.">
                {[30, 52, 75, 98, 121, 144].map((py) => <path key={py} className="rain-gridline" d={`M36 ${py}H605`} />)}<path className="rain-zero-line" d={`M36 ${zero}H605`} />
                {rainfall.map((item, index) => { const bx = 75 + index * 137; const h = Math.abs(item.departure) * scale; const by = item.departure > 0 ? zero - h : zero; return <g key={item.month}><rect className={item.departure > 0 ? "rain-bar-positive" : "rain-bar-negative"} x={bx} y={by} width="58" height={h} rx="2"/><text className="rain-bar-value" x={bx + 29} y={item.departure > 0 ? by - 6 : by + h + 14} textAnchor="middle">{item.departure > 0 ? "+" : "−"}{Math.abs(item.departure)}%</text></g>; })}
            </svg><div className="rain-chart-axis"><span>June</span><span>July</span><span>August</span><span>September</span></div><div className="rain-legend"><span><i className="rain-legend-positive"/>Above normal</span><span><i className="rain-legend-negative"/>Below normal</span></div>
        </>;
    }
    const max = 1000;
    const barWidth = (value) => value / max * 450;
    return <svg className="rain-chart-svg rain-total-svg" viewBox="0 0 620 160" role="img" aria-label="Season rainfall total: 765.8 millimetres observed compared with a normal 887.5 millimetres.">
        {[0, 250, 500, 750, 1000].map((value) => { const px = 120 + value / max * 450; return <g key={value}><path className="rain-gridline" d={`M${px} 18V130`}/><text className="rain-scale-label" x={px} y="148" textAnchor="middle">{value}</text></g>; })}
        <text className="rain-total-label" x="5" y="55">Observed</text><rect className="rain-bar-observed" x="120" y="36" width={barWidth(765.8)} height="27" rx="3"/><text className="rain-total-value" x={126 + barWidth(765.8)} y="54">765.8 mm</text>
        <text className="rain-total-label" x="5" y="103">Normal</text><rect className="rain-bar-normal" x="120" y="84" width={barWidth(887.5)} height="27" rx="3"/><text className="rain-total-value" x={126 + barWidth(887.5)} y="102">887.5 mm</text>
    </svg>;
}

function LinePlot({ series, categories, unit = "" }) {
    const values = series.flatMap((item) => item.values);
    const max = Math.ceil(Math.max(...values) / 10) * 10 || 10;
    const x0 = 60, x1 = 600, y0 = 18, y1 = 145;
    const px = (i) => x0 + (categories.length < 2 ? .5 : i / (categories.length - 1)) * (x1 - x0);
    const py = (v) => y1 - (v / max) * (y1 - y0);
    const colors = ["#456f50", "#879aab"];
    return <svg className="generic-chart-svg" viewBox="0 0 620 180" role="img" aria-label={`Line chart across ${categories.join(", ")}`}>
        {[0, .25, .5, .75, 1].map((f) => <g key={f}><path className="generic-gridline" d={`M${x0} ${y1 - f * (y1 - y0)}H${x1}`}/><text className="generic-label" x={x0 - 8} y={y1 - f * (y1 - y0) + 3} textAnchor="end">{Math.round(max * f)}{unit}</text></g>)}
        {series.map((item, si) => <g key={item.name}><polyline points={item.values.map((v, i) => `${px(i)},${py(v)}`).join(" ")} fill="none" stroke={colors[si % colors.length]} strokeWidth="3" strokeDasharray={item.name.toLowerCase().includes("normal") ? "6 5" : undefined}/>{item.values.map((v, i) => <circle key={i} cx={px(i)} cy={py(v)} r="4" fill={colors[si % colors.length]}><title>{item.name} {categories[i]}: {v}{unit}</title></circle>)}</g>)}
        {categories.map((label, i) => <text key={label} className="generic-label" x={px(i)} y="166" textAnchor="middle">{label}</text>)}
    </svg>;
}

function BarPlot({ items, unit = "" }) {
    const values = items.map((item) => item.value);
    const min = Math.min(0, ...values), max = Math.max(1, ...values), span = max - min || 1;
    const left = 160, right = 595, zero = left + (0 - min) / span * (right - left);
    const height = Math.max(165, items.length * 27 + 30);
    return <svg className="generic-chart-svg" style={{ height }} viewBox={`0 0 620 ${height}`} role="img" aria-label={`Bar chart: ${items.map((d) => `${d.label} ${d.display || d.value}`).join(", ")}`}>
        <path className="generic-axis" d={`M${zero} 18V${height - 12}`}/>{items.map((item, i) => { const yy = 24 + i * 27, end = left + (item.value - min) / span * (right - left), width = Math.abs(end - zero), negative = item.value < 0, text = item.display || `${item.value}${unit}`; return <g key={item.label}><text className="generic-label" x="0" y={yy + 11}>{item.label}</text><rect x={negative ? zero - width : zero} y={yy} width={Math.max(2, width)} height="13" rx="2" fill={negative ? "#a27d67" : "#456f50"}/><text className="generic-value" x={negative ? Math.max(left, zero - width - 5) : Math.min(right - 5, zero + width + 5)} y={yy + 11} textAnchor={negative ? "end" : "start"}>{text}</text></g>; })}
    </svg>;
}

function DistributionPlot({ type }) {
    const sorted = [...stateRatios].sort((a, b) => a - b);
    if (type === "education-histogram") {
        const bins = [[8, 14], [15, 20], [21, 25], [26, 30], [31, 35]].map(([low, high]) => ({ low, high, value: stateRatios.filter((v) => v >= low && v <= high).length }));
        const maxCount = Math.max(...bins.map((bin) => bin.value));
        const baseline = 139;
        return <svg className="generic-chart-svg" viewBox="0 0 620 180" role="img" aria-label="Histogram of pupil–teacher ratios across 36 states and union territories.">
            {[0, 5, 10, 15].map((v) => <g key={v}><path className="generic-gridline" d={`M64 ${baseline - v * 6}H600`}/><text className="generic-label" x="56" y={baseline - v * 6 + 3} textAnchor="end">{v}</text></g>)}
            {bins.map((bin, i) => { const x = 70 + i * 106, height = bin.value / maxCount * 90; return <g key={bin.low}><rect x={x} y={baseline - height} width="104" height={height} fill="#6e8e72" stroke="#fff" strokeWidth="2"><title>{bin.low} to {bin.high} pupils per teacher: {bin.value} states/UTs</title></rect><text className="generic-value" x={x + 52} y={baseline - height - 5} textAnchor="middle">{bin.value}</text><text className="generic-label" x={x + 52} y="155" textAnchor="middle">{bin.low}–{bin.high}</text></g>; })}
            <text className="generic-label" x="330" y="176" textAnchor="middle">Pupils per teacher · number of states/UTs</text>
        </svg>;
    }
    const q = (p) => { const n = (sorted.length - 1) * p, lo = Math.floor(n), t = n - lo; return sorted[lo] + (sorted[Math.min(lo + 1, sorted.length - 1)] - sorted[lo]) * t; };
    const low = sorted[0], high = sorted[sorted.length - 1], q1 = q(.25), median = q(.5), q3 = q(.75), scale = (v) => 70 + v / 40 * 500;
    return <svg className="generic-chart-svg" viewBox="0 0 620 180" role="img" aria-label={`Boxplot, pupil–teacher ratio across 36 states and union territories: min ${low}, Q1 ${q1.toFixed(1)}, median ${median.toFixed(1)}, Q3 ${q3.toFixed(1)}, max ${high}`}>
        {[0, 10, 20, 30, 40].map((v) => <g key={v}><path className="generic-gridline" d={`M${scale(v)} 32V132`}/><text className="generic-label" x={scale(v)} y="151" textAnchor="middle">{v}</text></g>)}
        <path d={`M${scale(low)} 82H${scale(high)} M${scale(low)} 70V94 M${scale(high)} 70V94`} fill="none" stroke="#456f50" strokeWidth="2"/><rect x={scale(q1)} y="62" width={scale(q3) - scale(q1)} height="40" fill="#dce9dd" stroke="#456f50"/><path d={`M${scale(median)} 62V102`} stroke="#a27d67" strokeWidth="3"/><text className="generic-label" x="320" y="174" textAnchor="middle">Pupils per teacher · 36 states/UTs</text>
    </svg>;
}

function ScatterPlot() {
    const points = [{ label: "India", x: 169, y: 25 }, { label: "Bihar", x: 225, y: 32 }, { label: "Delhi", x: 820, y: 28 }, { label: "Kerala", x: 396, y: 22 }];
    const x = (v) => 75 + v / 900 * 500, y = (v) => 145 - v / 40 * 120;
    return <svg className="generic-chart-svg" viewBox="0 0 620 185" role="img" aria-label="Scatter plot of average enrolment per school and pupils per teacher for four regions.">
        {[0, 10, 20, 30, 40].map((v) => <g key={v}><path className="generic-gridline" d={`M75 ${y(v)}H575`}/><text className="generic-label" x="65" y={y(v) + 3} textAnchor="end">{v}</text></g>)}
        <path className="generic-axis" d="M75 20V145H575"/>{points.map((p) => <g key={p.label}><circle cx={x(p.x)} cy={y(p.y)} r="6" fill="#456f50"><title>{p.label}: {p.x} enrolments per school, {p.y} pupils per teacher</title></circle><text className="generic-label" x={x(p.x) + 8} y={y(p.y) - 7}>{p.label}</text></g>)}
        <text className="generic-label" x="325" y="178" textAnchor="middle">Average enrolment per school</text><text className="generic-label" transform="translate(15 85) rotate(-90)" textAnchor="middle">Pupils per teacher</text>
    </svg>;
}

function DonutPlot({ items }) {
    const total = items.reduce((sum, item) => sum + item.value, 0), colors = ["#456f50", "#879aab", "#b18a5d", "#9a7895"];
    let angle = -Math.PI / 2;
    const arcs = items.map((item, i) => { const end = angle + item.value / total * Math.PI * 2, r = 61, inner = 35, cx = 145, cy = 85; const point = (radius, a) => [cx + radius * Math.cos(a), cy + radius * Math.sin(a)]; const [x1, y1] = point(r, angle), [x2, y2] = point(r, end), [ix2, iy2] = point(inner, end), [ix1, iy1] = point(inner, angle); const large = end - angle > Math.PI ? 1 : 0; const d = `M${x1} ${y1} A${r} ${r} 0 ${large} 1 ${x2} ${y2} L${ix2} ${iy2} A${inner} ${inner} 0 ${large} 0 ${ix1} ${iy1} Z`; angle = end; return <path key={item.label} d={d} fill={colors[i % colors.length]}><title>{item.label}: {(item.value / total * 100).toFixed(1)}%</title></path>; });
    return <svg className="generic-chart-svg" viewBox="0 0 620 180" role="img" aria-label={`Donut chart: ${items.map((item) => `${item.label} ${(item.value / total * 100).toFixed(1)} percent`).join(", ")}`}>
        {arcs}<text x="145" y="89" textAnchor="middle" className="generic-value">Share</text>{items.map((item, i) => <g key={item.label}><circle cx="250" cy={48 + i * 28} r="5" fill={colors[i % colors.length]}/><text className="generic-label" x="264" y={52 + i * 28}>{item.label} · {(item.value / total * 100).toFixed(1)}%</text></g>)}
    </svg>;
}

function ExampleChart({ exampleKey, view }) {
    if (exampleKey === "rainfall") return <RainfallChart type={view.plot} />;
    if (view.plot === "cpi-line") return <LinePlot series={[{ name: "Rural", values: [8.65, 6.31] }, { name: "Urban", values: [7.9, 5.53] }]} categories={["Dec 2024", "Jan 2025"]} unit="%"/>;
    if (view.plot === "health-line") return <LinePlot series={[{ name: "NFHS-4", values: [78.9, 63.8, 99.8, 70.6] }, { name: "NFHS-5", values: [88.6, 76.2, 99.8, 84.1] }]} categories={["India", "Bihar", "Kerala", "Assam"]} unit="%"/>;
    if (view.plot === "cpi-bar") return <BarPlot items={[{ label: "Rural · Dec", value: 8.65, display: "8.65%" }, { label: "Rural · Jan", value: 6.31, display: "6.31%" }, { label: "Urban · Dec", value: 7.9, display: "7.90%" }, { label: "Urban · Jan", value: 5.53, display: "5.53%" }]} />;
    if (view.plot === "market-bar") return <BarPlot items={[{ label: "1 month", value: -2.02, display: "−2.02%" }, { label: "3 months", value: -8.25, display: "−8.25%" }, { label: "1 year", value: 10.09, display: "+10.09%" }]} />;
    if (view.plot === "education-bar") return <BarPlot items={[{ label: "India", value: 25 }, { label: "Bihar", value: 32 }, { label: "Delhi", value: 28 }, { label: "Kerala", value: 22 }]} unit=" pupils/teacher" />;
    if (view.plot === "health-bar") return <BarPlot items={[{ label: "India · NFHS-4", value: 78.9, display: "78.9%" }, { label: "India · NFHS-5", value: 88.6, display: "88.6%" }, { label: "Bihar · NFHS-4", value: 63.8, display: "63.8%" }, { label: "Bihar · NFHS-5", value: 76.2, display: "76.2%" }, { label: "Kerala · NFHS-5", value: 99.8, display: "99.8%" }]} />;
    if (view.plot === "aqi-bar") return <BarPlot items={[{ label: "Good", value: 50, display: "0–50" }, { label: "Satisfactory", value: 100, display: "51–100" }, { label: "Moderate", value: 200, display: "101–200" }, { label: "Poor", value: 300, display: "201–300" }, { label: "Very Poor", value: 400, display: "301–400" }, { label: "Severe", value: 500, display: "401–500" }]} />;
    if (view.plot === "education-scatter") return <ScatterPlot />;
    if (view.plot === "education-histogram" || view.plot === "education-boxplot") return <DistributionPlot type={view.plot} />;
    if (view.plot === "education-pie") return <DonutPlot items={[{ label: "Bihar", value: 21348149 }, { label: "Delhi", value: 4506578 }, { label: "Kerala", value: 6281704 }]} />;
    if (view.plot === "health-pie") return <DonutPlot items={[{ label: "In a health facility", value: 88.6 }, { label: "Outside a health facility", value: 11.4 }]} />;
    return null;
}

const topicCards = [
    { key: "rainfall", category: "Climate · Agriculture", title: "Monsoon rainfall by month and state", measures: "Observed and normal rainfall (mm), monthly departure (%).", example: "In 2015, June recorded 189.0 mm against a 163.6 mm normal (+16%).", link: chartSource, linkText: "Open IMD rainfall explorer →" },
    { key: "cpi", category: "Economy · Prices", title: "Consumer Price Index (CPI)", measures: "Monthly price index and inflation by consumer group and rural/urban sector.", example: "Food inflation eased in both rural and urban areas from December 2024 to January 2025.", link: examples.cpi.sourceUrl, linkText: "Open MoSPI January 2025 CPI release →" },
    { key: "market", category: "Markets · Trading", title: "Equity returns across time horizons", measures: "Index returns across one month, three months, and one year.", example: "NIFTY 50 returns were negative over one and three months, but positive over one year at the report date.", link: examples.market.sourceUrl, linkText: "Open NSE Indices December 2024 report →" },
    { key: "education", category: "Education", title: "Schools, enrolment and teachers", measures: "Schools, enrolment, teachers and pupil–teacher ratios by region.", example: "Compare staffing ratios with school enrolment, then inspect the state-level distribution.", link: examples.education.sourceUrl, linkText: "Open UDISE+ 2023–24 report →" },
    { key: "health", category: "Health · Population", title: "Health and family indicators", measures: "Health, nutrition and household indicators from NFHS survey rounds.", example: "Institutional births rose between NFHS-4 and NFHS-5 in India and Bihar.", link: examples.health.sourceUrl, linkText: "Open NFHS-5 state fact sheets →" },
    { key: "aqi", category: "Environment · Cities", title: "Air quality by station and date", measures: "Station AQI, pollutant readings and category by location and observation time.", example: "See CPCB AQI bands and ranges; use the dashboard for current station readings.", link: examples.aqi.sourceUrl, linkText: "Open CPCB national AQI dashboard →" },
];

function Home() {
    const location = useLocation();
    const [activeExample, setActiveExample] = useState("rainfall");
    const [activeViewIndex, setActiveViewIndex] = useState(0);
    const [settingsError, setSettingsError] = useState(location.state?.settingsError || "");

    useEffect(() => {
        const token = window.localStorage.getItem("adp-access-token");
        if (!token) return undefined;

        let isCurrent = true;
        apiRequest("/api/settings", { token })
            .then((settings) => {
                if (!isCurrent) return;
                setSettingsError("");
                const sample = Object.prototype.hasOwnProperty.call(examples, settings.home_featured_sample)
                    ? settings.home_featured_sample
                    : "rainfall";
                setActiveExample(sample);
                setActiveViewIndex(0);
            })
            .catch((error) => {
                if (isCurrent) setSettingsError(error.message || "Home preferences could not be loaded.");
            });
        return () => {
            isCurrent = false;
        };
    }, [location.state?.settingsError]);

    const data = examples[activeExample];
    const view = data.views[activeViewIndex];
    const changeView = (direction) => setActiveViewIndex((current) => (current + direction + data.views.length) % data.views.length);
    const selectExample = (key) => {
        setActiveExample(key);
        setActiveViewIndex(0);
        const reduceMotion = document.documentElement.dataset.adpReduceMotion === "true";
        document.getElementById("home-preview")?.scrollIntoView({
            behavior: reduceMotion ? "auto" : "smooth",
            block: "center",
        });
    };

    return (
        <div className="home-page">
            <div className="home-main-content">
                {settingsError && <p className="home-settings-error" role="alert">{settingsError}</p>}
                <section className="home-hero" aria-labelledby="home-heading">
                    <div className="home-hero-copy">
                        <p className="home-eyebrow">A workspace for clear analysis</p>
                        <h1 id="home-heading">Make your data<br/>make sense.</h1>
                        <p className="home-hero-description">Prepare a dataset, explore what it shows, and present findings with enough context for others to understand.</p>
                        <div className="home-hero-actions"><Link className="home-button home-button-primary" to="/login">Login</Link><Link className="home-button home-button-secondary" to="/register">Get started</Link></div>
                        <p className="home-credential-note"><strong>New to the platform?</strong> Register to receive your sign-in username and temporary password by email.</p>
                    </div>
                    <section className="home-preview" id="home-preview" aria-label="Interactive public data example">
                        <div className="home-preview-topbar"><strong>Data example · {data.title}</strong><span>{data.sourceLabel}</span></div>
                        <div className="home-metric-grid">{data.summary.map(([label, value]) => <article className="home-metric-card" key={label}><span>{label}</span><strong>{value}</strong></article>)}</div>
                        <div className="home-chart-card">
                            <div className="home-chart-heading"><div><h2>{view.title}</h2><p>{view.description}</p></div><div className="home-chart-controls" role="group" aria-label="Browse chart views"><button type="button" onClick={() => changeView(-1)} aria-label="Show previous chart view" disabled={data.views.length < 2}>‹</button><span aria-live="polite">{activeViewIndex + 1} / {data.views.length}</span><button type="button" onClick={() => changeView(1)} aria-label="Show next chart view" disabled={data.views.length < 2}>›</button></div></div>
                            <div className="home-chart-plot"><ExampleChart exampleKey={activeExample} view={view}/></div>
                            {view.type === "line" && <div className="home-series-legend">{(activeExample === "rainfall" ? ["Normal", "Observed"] : activeExample === "cpi" ? ["Rural", "Urban"] : ["NFHS-4", "NFHS-5"]).map((name, index) => <span key={name}><i className={`series-key series-key-${index}`}/>{name}</span>)}</div>}
                            <p className="home-chart-insight">{view.insight || data.insight}</p>
                            <p className="home-chart-source">Source: <a href={data.sourceUrl} target="_blank" rel="noreferrer">{data.source}</a>. Historical public data or reference thresholds, not a live feed.</p>
                        </div>
                    </section>
                </section>

                <section className="home-data-example" id="home-data-example" aria-labelledby="home-data-heading">
                    <div className="home-data-heading"><div><p className="home-section-kicker">PUBLIC DATA EXAMPLE</p><h2 id="home-data-heading">{({ rainfall: "Explore the rainfall data", cpi: "Explore consumer price data", market: "Explore market performance", education: "Explore education statistics", health: "Explore health indicators", aqi: "Explore air quality categories" })[activeExample]}</h2></div><p>{data.measure} · {data.period}</p></div>
                    <div className="home-data-table-wrap"><table className="home-data-table"><thead><tr>{data.columns.map((column) => <th scope="col" key={column}>{column}</th>)}</tr></thead><tbody>{data.rows.map((row, i) => <tr key={`${activeExample}-${i}`}>{row.map((cell, j) => j === 0 ? <th scope="row" key={j}>{cell}</th> : <td key={j}>{cell}</td>)}</tr>)}</tbody></table></div>
                    <div className="home-data-context" aria-label="Dataset context"><div><strong>Dataset status</strong><span>{data.status}</span></div><div><strong>Period covered</strong><span>{data.period}</span></div><div><strong>Measure</strong><span>{data.measure}</span></div><div><strong>Data source</strong><span>{data.source.split(",")[0]}</span></div></div>
                </section>

                <section className="home-topics" id="home-topics" aria-labelledby="home-topics-heading">
                    <div className="home-section-heading"><div><p className="home-section-kicker">PUBLIC EXAMPLES</p><h2 id="home-topics-heading">Data topics and examples</h2></div><p>Choose a subject to see its example, chart, summary values, source, and data table.</p></div>
                    <div className="home-topic-grid">{topicCards.map((card) => <article key={card.key} className={`home-topic-card${activeExample === card.key ? " is-selected" : ""}`} role="button" tabIndex="0" aria-pressed={activeExample === card.key} onClick={() => selectExample(card.key)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); selectExample(card.key); } }}><span className="home-topic-category">{card.category}</span><h3>{card.title}</h3><p><strong>Measures:</strong> {card.measures}</p><p className="home-topic-example"><strong>Example:</strong> {card.example}</p><a href={card.link} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{card.linkText}</a></article>)}</div>
                </section>

                <section className="home-workflow" id="workflow" aria-labelledby="workflow-heading">
                    <div className="home-section-heading"><div><p className="home-section-kicker">ONE CONNECTED WORKFLOW</p><h2 id="workflow-heading">From data to a clear result.</h2></div><p>Keep the data, analysis, and explanation connected as you move from a file to a finding.</p></div>
                    <div className="home-workflow-grid"><article className="home-workflow-tile"><span>01 · PREPARE</span><h3>Check the data before analysis</h3><p>Review column names and value types. Look for missing entries, duplicate rows, inconsistent units, or date formats.</p><small><strong>Keep:</strong> the source, covered dates, geographic scope and a note about any corrections.</small></article><article className="home-workflow-tile"><span>02 · ANALYZE</span><h3>Explore a clear question</h3><p>Compare groups or periods, inspect unusual values, and choose a chart that fits the question and the kind of measure.</p><small><strong>Check:</strong> labels, scales, units, sample size and whether comparisons use the same definitions.</small></article><article className="home-workflow-tile"><span>03 · PRESENT</span><h3>Make the finding understandable</h3><p>Build a dashboard or report that gives readers the result and enough context to interpret it correctly.</p><small><strong>Include:</strong> a descriptive title, source, time period, units, key values and a concise takeaway.</small></article></div>
                </section>

                <section className="home-guides" id="home-guides" aria-labelledby="home-guides-heading"><div className="home-section-heading"><div><p className="home-section-kicker">GOOD ANALYSIS PRACTICE</p><h2 id="home-guides-heading">How to use an example responsibly</h2></div></div><div className="home-topic-grid home-guide-grid"><article className="home-guide-card"><span>VERIFY</span><h3>Check the source and period</h3><p>Confirm who published the data, which dates and locations it covers, and when it was last updated.</p></article><article className="home-guide-card"><span>COMPARE</span><h3>Use matching measures</h3><p>Compare like with like. Keep units, geographic scope and time intervals consistent across the chart.</p></article><article className="home-guide-card"><span>EXPLAIN</span><h3>Show values behind the trend</h3><p>Pair a chart with the underlying table, define the baseline and state what the data cannot tell you.</p></article></div></section>

                <section className="home-faq" id="home-help" aria-labelledby="home-faq-heading"><div className="home-section-heading"><div><p className="home-section-kicker">HELP &amp; SUPPORT</p><h2 id="home-faq-heading">Frequently asked questions</h2></div><p>Practical answers about data, charts, and preparing a report.</p></div><div className="home-faq-list"><details open><summary>What kind of dataset can I analyze?</summary><p>A structured table is easiest to work with: one row per observation and one column per measure or category. Check the upload screen for file formats supported by the current build.</p></details><details><summary>How can I tell whether datasets can be compared?</summary><p>Check that they use compatible definitions, units, date ranges, and geographic coverage. If a measure or collection method changed, note that before interpreting the difference.</p></details><details><summary>What should I check before interpreting a chart?</summary><p>Read its title, axis labels, units, period, and comparison baseline. Then check the source and whether missing values or changes in coverage could affect the pattern.</p></details><details><summary>Does a trend explain what caused it?</summary><p>No. A chart can show that values changed or moved together; it does not by itself establish why. Describe the observed pattern and avoid claiming a cause without supporting evidence.</p></details></div></section>
            </div>
        </div>
    );
}

export default Home;
