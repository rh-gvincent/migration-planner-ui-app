import React from "react";
import { useParams } from "react-router-dom";

import Report from "./Report";

const ReportPage: React.FC = () => {
  const { id } = useParams();
  return <Report key={id} />;
};

ReportPage.displayName = "ReportPage";

export default ReportPage;
