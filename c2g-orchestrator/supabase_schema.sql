-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gkyhvikuizoceekuduwe/editor

CREATE TABLE grid_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  price_mwh FLOAT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('NORMAL','WARNING','EMERGENCY','CRITICAL'))
);

CREATE TABLE action_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  action_taken TEXT NOT NULL,
  pods_scaled INT DEFAULT 0,
  estimated_savings FLOAT DEFAULT 0.0,
  duration_seconds FLOAT
);

ALTER PUBLICATION supabase_realtime ADD TABLE grid_events;
ALTER PUBLICATION supabase_realtime ADD TABLE action_logs;

CREATE INDEX idx_grid_events_timestamp ON grid_events(timestamp DESC);
CREATE INDEX idx_action_logs_timestamp ON action_logs(timestamp DESC);
