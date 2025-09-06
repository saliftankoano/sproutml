import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full">
      <div className="flex flex-col items-center justify-center mt-10">
        <h1 className="text-4xl font-bold"> Welcome to SproutML 🌱</h1>
        <p className="text-lg">
          SproutML is a platform for training and deploying machine learning models.
        </p>
      </div>

    </div>
  );
}
