// Mock API service to replace Supabase
// Replace this with your actual backend API calls

export const mockApi = {
  // Mock data fetching
  async fetchData(table: string, filters?: any) {
    console.log(`Fetching from ${table}`, filters);
    return { data: [], error: null };
  },

  // Mock data insertion
  async insertData(table: string, data: any) {
    console.log(`Inserting into ${table}`, data);
    return { data: null, error: null };
  },

  // Mock data update
  async updateData(table: string, id: string, data: any) {
    console.log(`Updating ${table} ${id}`, data);
    return { data: null, error: null };
  },

  // Mock data deletion
  async deleteData(table: string, id: string) {
    console.log(`Deleting from ${table} ${id}`);
    return { data: null, error: null };
  },
};

// Mock types
export type StreamType = "Science" | "Arts" | "Commerce";
export type AppRole = "student" | "teacher" | "admin" | "registrar" | "director" | "parent";
