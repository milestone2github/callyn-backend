export function getAllocatedSimSerial(user) {
  if (!user || !Array.isArray(user.assets)) return null;

  // keep only allocated SIM assets
  const allocatedSims = user.assets
    .filter(
      (a) =>
        a.status === "allocated" &&
        a.asset &&
        a.asset.type &&
        a.asset.type.name === "SIM Card"
    )
    .sort((a, b) => new Date(b.allocatedAt || 0) - new Date(a.allocatedAt || 0));

  // return serial number of latest allocated SIM
  return allocatedSims[0]?.asset?.serialNumber || null;
}