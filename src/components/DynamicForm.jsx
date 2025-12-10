import { useState } from "react";

export default function DynamicForm({ entity, onSubmit }) {
  const [formData, setFormData] = useState(entity.data);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg shadow">
      {Object.entries(formData).map(([key, value]) => {
        const isReadOnly = entity.readOnly?.includes(key);
        return (
          <div key={key} className="mb-4">
            <label className="block text-sm font-medium text-gray-700 capitalize mb-1">
              {entity.labels[key] || key}
            </label>
            <input
              type="text"
              name={key}
              value={value}
              onChange={handleChange}
              readOnly={isReadOnly}
              className={`mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm ${
                isReadOnly ? 'bg-gray-100 cursor-not-allowed' : ''
              }`}
            />
          </div>
        );
      })}
      <button type="submit" className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-hover">
        Guardar Cambios
      </button>
    </form>
  );
} 