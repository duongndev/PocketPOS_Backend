export const buildDailyChart = (data) => {
  const chart = Array.from(
    { length: 24 },
    (_, hour) => ({
      label: `${hour.toString().padStart(2, "0")}h`,
      revenue: 0,
    })
  );

  data.forEach((item) => {
    chart[item._id].revenue = item.revenue;
  });

  return chart;
};

export const buildWeeklyChart = (data, startDate) => {
  const chartMap = new Map();
  const chart = [];

  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);

    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const label = `${dd}/${mm}`;

    const dataPoint = { label, revenue: 0 };
    chart.push(dataPoint);
    chartMap.set(label, dataPoint);
  }

  data.forEach((item) => {
    const dataPoint = chartMap.get(item._id);
    if (dataPoint) {
      dataPoint.revenue = item.revenue;
    }
  });

  return chart;
};

export const buildMonthlyChart = (data, startDate) => {
  const daysInMonth = new Date(
    startDate.getFullYear(),
    startDate.getMonth() + 1,
    0
  ).getDate();

  const chart = Array.from(
    { length: daysInMonth },
    (_, index) => ({
      label: String(index + 1).padStart(2, "0"),
      revenue: 0,
    })
  );

  data.forEach((item) => {
    chart[item._id - 1].revenue = item.revenue;
  });

  return chart;
};