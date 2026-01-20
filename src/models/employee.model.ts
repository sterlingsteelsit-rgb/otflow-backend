import mongoose, { Schema, type InferSchemaType, Types } from "mongoose";

const employeeSchema = new Schema(
  {
    empId: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: false, lowercase: true, trim: true },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, required: false },
  },
  { timestamps: true },
);

employeeSchema.index({ empId: 1 }, { unique: true });
employeeSchema.index({ empId: "text", name: "text" });
employeeSchema.index({ isDeleted: 1 });
employeeSchema.index({ createdAt: -1 });

export type EmployeeDoc = InferSchemaType<typeof employeeSchema> & {
  _id: Types.ObjectId;
};
export const Employee = mongoose.model("Employee", employeeSchema);
