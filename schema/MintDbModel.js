import mongoose from 'mongoose';
const { Schema } = mongoose;

const mintDbSchema = new Schema({
  _id: Schema.Types.ObjectId,
  APPCODE: String,
  AUM: Number,
  "Birthday Wishes": Boolean,
  "CREATED AT": String, 
  "DATE OF BIRTH": String, // You might consider using the 'Date' type
  DATE_MOVED_ON_DATE: String, // You might consider using the 'Date' type
  EMAIL: String,
  "FAMILY HEAD": String,
  "First Imported Date": String, // You might consider using the 'Date' type
  "IWELL CODE": Number,
  MOBILE: String,
  NAME: String,
  PAN: String,
  "RELATIONSHIP  MANAGER": String, // Note: This key has two spaces
  "SERVICE  R M": Number, // Note: Two spaces. 'Number' type handles 'NaN' values.
  "SOURCE": Number, // 'Number' type handles 'NaN' values.
  "SUB  BROKER": String, // Note: Two spaces
  USERNAME: String,
  "Upserted Timestamp": String, // You might consider using the 'Date' type
  blog_subscription: Boolean,
  ipo_status: Boolean,
  serial_number: Number,
  "SECONDARY RELATIONSHIP MANAGER": String
}, {
  // Explicitly tell Mongoose which collection to use
  collection: 'MintDb',
  // Disable Mongoose's automatic 'createdAt' and 'updatedAt' fields
  timestamps: false
});

// Create and export the model
const MintDbModel = mongoose.model('MintDb', mintDbSchema);

export default MintDbModel;